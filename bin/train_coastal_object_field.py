"""Train a bounded fixed-light axis-aligned 3D Gaussian object representation.

Original implementation; no official 3DGS code, weights or paper assets are used.
The camera projection and front-to-back alpha model are shared with the browser.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import time
import numpy as np
import torch
from torch import nn

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artwork/coastal-home/learned-object'

class Gaussians(nn.Module):
    def __init__(self,samples):
        super().__init__()
        self.position=nn.Parameter(torch.tensor([s['position'] for s in samples],dtype=torch.float32))
        self.log_scale=nn.Parameter(torch.full_like(self.position,math.log(.065)))
        colors=torch.tensor([s['color'] for s in samples],dtype=torch.float32).clamp(.03,.97)
        self.color=nn.Parameter(torch.logit(colors))
        self.opacity=nn.Parameter(torch.full((len(samples),),.8))

    def render(self,view,bg):
        size=view['size']; focal=view['focal']
        transform=torch.tensor(np.array(view['worldToCamera']).reshape(4,4,order='F'),dtype=torch.float32)
        xyz=self.position@transform[:3,:3].T+transform[:3,3]
        depth=-xyz[:,2].clamp(max=-.05)
        mean=xyz[:,:2]*(focal/depth[:,None])+size*.5
        r=transform[:3,:3]
        scale=self.log_scale.clamp(math.log(.006),math.log(.3)).exp()
        cov=(r[None,:,:]*scale[:,None,:]**2)@r.T
        j=torch.zeros((len(xyz),2,3),dtype=xyz.dtype)
        j[:,0,0]=focal/depth;j[:,1,1]=focal/depth
        j[:,:,2]=focal*xyz[:,:2]/depth[:,None]**2
        c=j@cov@j.transpose(1,2)+torch.eye(2)[None,:,:]*.3
        det=(c[:,0,0]*c[:,1,1]-c[:,0,1]**2).clamp(min=1e-6)
        y,x=torch.meshgrid(torch.arange(size)+.5,torch.arange(size)+.5,indexing='ij')
        delta=torch.stack([x,y],-1).reshape(1,-1,2)-mean[:,None,:]
        dist=(c[:,1,1,None]*delta[:,:,0]**2+c[:,0,0,None]*delta[:,:,1]**2-2*c[:,0,1,None]*delta[:,:,0]*delta[:,:,1])/det[:,None]
        alpha=self.opacity.sigmoid()[:,None]*torch.exp(-.5*dist.clamp(min=0,max=80))
        order=depth.argsort();alpha=alpha[order].clamp(max=.98)
        trans=torch.cumprod(1-alpha+1e-10,0)
        weight=alpha*torch.cat([torch.ones_like(trans[:1]),trans[:-1]],0)
        image=weight.T@self.color.sigmoid()[order]+trans[-1,:,None]*bg
        return image.reshape(size,size,3)


def psnr(mse):return -10*math.log10(mse)

def main():
    p=argparse.ArgumentParser();p.add_argument('--steps',type=int,default=1000);p.add_argument('--threads',type=int,default=4);a=p.parse_args()
    torch.manual_seed(1701);torch.set_num_threads(a.threads);torch.use_deterministic_algorithms(True)
    data=json.loads((OUT/'data/dataset.json').read_text())
    images=[]
    for v in data['views']:
        raw=(OUT/'data'/v['file']).read_bytes()
        if hashlib.sha256(raw).hexdigest()!=v['sha256']:raise ValueError('Dataset hash mismatch')
        images.append(torch.tensor(np.frombuffer(raw,dtype=np.uint8).copy().reshape(v['size'],v['size'],4)[...,:3]/255,dtype=torch.float32))
    train=[i for i,v in enumerate(data['views']) if v['split']=='train'];test=[i for i,v in enumerate(data['views']) if v['split']=='test']
    model=Gaussians(data['surface']['samples']);bg=torch.tensor(data['backgroundSrgb'])
    optim=torch.optim.Adam([{'params':[model.position],'lr':.003},{'params':[model.log_scale],'lr':.008},{'params':[model.color,model.opacity],'lr':.025}])
    initial=[]
    with torch.no_grad():
        for i in train:initial.append(float((model.render(data['views'][i],bg)-images[i]).square().mean()))
    started=time.perf_counter();history=[]
    for step in range(1,a.steps+1):
        i=train[int(torch.randint(len(train),(1,)))];pred=model.render(data['views'][i],bg)
        loss=(pred-images[i]).square().mean()
        optim.zero_grad(set_to_none=True);loss.backward();optim.step()
        with torch.no_grad():model.position.clamp_(-1.3,1.3);model.log_scale.clamp_(math.log(.006),math.log(.3))
        if step==1 or step%100==0 or step==a.steps:
            row={'step':step,'train_view':i,'batch_mse':float(loss),'elapsed_seconds':time.perf_counter()-started};history.append(row);print(json.dumps(row),flush=True)
    # Fixed training budget, no test selection. Test views are first read by the model here.
    result=[]
    with torch.no_grad():
        for i in train+test:
            pred=model.render(data['views'][i],bg);mse=float((pred-images[i]).square().mean());mask=(images[i]-bg).abs().amax(dim=-1)>.04
            foreground_mse=float((pred[mask]-images[i][mask]).square().mean())
            result.append({'view':i,'split':data['views'][i]['split'],'mse':mse,'psnr_db':psnr(mse),'foreground_pixels':int(mask.sum()),'foreground_mse':foreground_mse,'foreground_psnr_db':psnr(foreground_mse)})
    values=np.concatenate([model.position.detach().numpy(),model.log_scale.exp().detach().numpy(),model.color.sigmoid().detach().numpy(),model.opacity.sigmoid().detach().numpy()[:,None]],axis=1).astype('<f4')
    reference=dict(data['views'][test[0]])
    reference['size']=256;reference['focal']*=256/data['views'][test[0]]['size']
    with torch.no_grad():
        (OUT/'python-reference.f32').write_bytes(model.render(reference,bg).numpy().astype('<f4').tobytes())
    raw=values.tobytes();(OUT/'gaussians.f32').write_bytes(raw)
    manifest={'schema_version':1,'count':len(values),'stride':10,'layout':['position_x','position_y','position_z','scale_x','scale_y','scale_z','red_srgb','green_srgb','blue_srgb','opacity'],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'covariance':'Axis-aligned learned world covariance; exact perspective Jacobian projection with 0.3-pixel variance floor. No learned rotations, SH color, densification, pruning or official 3DGS implementation.','sourceSha256':data['sourceSha256'],'normalization':data['surface']['normalization']}
    (OUT/'gaussians.json').write_text(json.dumps(manifest,indent=2)+'\n')
    report={'schema_version':1,'trainer_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'steps':a.steps,'seed':1701,'torch':torch.__version__,'device':'cpu','threads':a.threads,'elapsed_seconds':time.perf_counter()-started,'source_bytes':data['sourceBytes'],'dataset_sha256':hashlib.sha256((OUT/'data/dataset.json').read_bytes()).hexdigest(),'train_views':train,'held_out_views':test,'selection':f'Fixed {a.steps}-step training budget, all model optimization uses training views only; held-out views never selected a checkpoint.','initial_train_mean_mse':float(np.mean(initial)),'history':history,'views':result,'train_psnr_db':psnr(float(np.mean([r['mse'] for r in result if r['split']=='train']))),'held_out_psnr_db':psnr(float(np.mean([r['mse'] for r in result if r['split']=='test']))),'held_out_foreground_psnr_db':psnr(float(np.mean([r['foreground_mse'] for r in result if r['split']=='test']))),'artifact':manifest}
    (OUT/'training.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['elapsed_seconds','train_psnr_db','held_out_psnr_db']}),flush=True)
if __name__=='__main__':main()
