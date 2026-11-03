import * as THREE from "../three.module.min.js";

// This is one source-measured pavilion chair, its linen pad, and a separately
// authored U footrest. The parts move together for the seating action; this does
// not imply mechanical joinery, an updated static-GI bake, or force simulation.
// The original 312bf6d0 shell supplies the ownership reference. Later source
// definitions come from the SHA-bound producer and require separate final
// geometry, material, contact and rendered admission.
const NATIVE = {
  maxOffset: 0.4,
  sources: [
    {
      id: "source-0",
      meshName: "core_estate_pavilion__pale_oak",
      materialName: "pale oak",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 8, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 8, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 4104,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "5e5cce6d5a487f413cdb73e826c96523a49fff2a4bae6d3c5a60f31c0b919689",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 4104,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "eead321a853d738ac7a4da9f52e6ed34659f5cbc7475057b35f3693585958e23",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 4104,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "5ce93283a7dac6b8470e8c5783aca35a60b369f15320a474e3569eea6c591c93",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 4104,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "b9b6cc0a24220ffc0ec1b223361ed563a40f08aa1b754949a5181732156b2032",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "e24aa86528d7c61dbd382cc4de8bebf170b6026d52c939744ea9f12961b9f9a4",
      },
    },
    {
      id: "source-1",
      meshName: "core_estate_pavilion__honey_ash002",
      materialName: "honey ash",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 8, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 1620,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "29494a660c2344a399bc9daa7a3b2658954335d1f69df4f15ccaedd1b6110a67",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 1620,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "f7afbdbfd2f166db8dfedf6979b90df8a891b033362ddaf037ea336a9214e6d6",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 1620,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "e9645eea80538fd19044a832c58c95c0f46b27af8d3e423a1998286f95d4f637",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 1620,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "d3dddc538099e497d9be9d4968da7f9ab19da91dda1ba91ea91aacaabd4fead5",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "1c74d1d536f5d45e098547b4cce1bf878e141020d53d3eeebe2a742ea7199b77",
      },
    },
    {
      id: "source-2",
      meshName: "core_estate_pavilion__linen",
      materialName: "linen",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 8, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 8, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 576,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "8c914215caf7854d8183174de52803de848545faaa0353a313f2ca2a1ee4edda",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 576,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "03bf7e20a7f97a7e26f0a914e58fb74b4687294253daae8f4fe68d2f87672ae9",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 576,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "adea5e0a9361c2700525b2452f81230a0f5c1fb310669e1a5b1d779143b9e297",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 576,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "6c121d3df204ed3e02522a1ad16e18073427e3d0e1c5fc1b9ddc5b306cdce4bd",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "48499cba6106e8901a1cb423746aa4447ae2057d4bc9c87cd194d6a9fcc42344",
      },
    },
    {
      id: "source-3",
      meshName: "core_estate_pavilion_breakfast_footrest_top__pale_oak",
      materialName: "pale oak",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 48,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "936748936a80a2e3aa6042e231f1a8432dfa6c7f2cdfea3b668119e804ff2340",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 48,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "79fd4a4283b824f3c4ba94fe1132d527c34d6ac7b347f2bd58f17aba8d2b704d",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 48,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "8f62c344eff1568474fb693b8c18526629db443b9653a84264189c97693605de",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 48,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "529dd692d479916f3d3f91c3647e7ff125d093d05964b81888f5b85df8d9ad82",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "a832139fbba4a14788d30eb5a0f6ef7281f6bcacd1dc7a86915e49b5aff420b9",
      },
    },
    {
      id: "source-4",
      meshName: "core_estate_pavilion_breakfast_footrest_west__pale_oak",
      materialName: "pale oak",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 24,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "23f1babefcde9e2da9beb85bde42f0f557f75f54688cff568efa93b04ffa43c8",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 24,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "f93280151288c354eea53799d41a85919a7d113d1084ae63039cf7a44b05d82c",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 24,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "ce65609cc564ce3d8cb72d46bc44cd5495afbad7bc61b5edfa0799baa5063191",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 24,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "19a7696aba62ed701746261c69282740fe2b4145bf7d280f8c2077fc10e4ad8b",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "11635a373f5ea68cd485278d65c7266a42cff45748c19f3f76bc133e81d132ec",
      },
    },
    {
      id: "source-5",
      meshName: "core_estate_pavilion_breakfast_footrest_east__pale_oak",
      materialName: "pale oak",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 24,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "c39225b884abd0aa3e1c9c4ee22d3d224e677bb952f5641523bed1daeec70fae",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 24,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "f93280151288c354eea53799d41a85919a7d113d1084ae63039cf7a44b05d82c",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 24,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "ce65609cc564ce3d8cb72d46bc44cd5495afbad7bc61b5edfa0799baa5063191",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 24,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "19a7696aba62ed701746261c69282740fe2b4145bf7d280f8c2077fc10e4ad8b",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "11635a373f5ea68cd485278d65c7266a42cff45748c19f3f76bc133e81d132ec",
      },
    },
    {
      id: "source-6",
      meshName: "core_estate_pavilion_breakfast_seatpad__linen",
      materialName: "linen",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 48,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "2393c5b7867c31e6bc045349be9c92fcfcaf631855aca8591f187b9d642221de",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 48,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "7516e9b2cace998819555235600f14a58857cb73a77cd15cb583191342e62779",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 48,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "8f62c344eff1568474fb693b8c18526629db443b9653a84264189c97693605de",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 48,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "24223021b926cfe54f8a0cff4c7411b110b8ca56d3661e467a775045b60c5470",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "e31e869c782335cb7862dfeca79857b96353fe3d25eb4881ada6118eb1c43dd2",
      },
    },
    {
      id: "source-7",
      meshName: "core_estate_pavilion_breakfast_lumbar_west__pale_oak",
      materialName: "pale oak",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "5f31d67287c2aac77aa0df006290f92c8c9e3f0f5e06ffd138fa0e6712f42058",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "52fcdf0247bb90dc634741ab807d561d717a9ad88b1239cef4c2f7902fe09aac",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "0052516839b94ee314a4e3b398c8036de3790d672194987a394ee60323848539",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "a4aa909d1dfa8b52bfc89216d1444fb687cb9e78b7e1851ac53a0e234f958b7a",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "dbc0ebe68a29c6ec9024a78cc02784bb5c35c3a5e35e1e6418dfdb63d953005d",
      },
    },
    {
      id: "source-8",
      meshName: "core_estate_pavilion_breakfast_lumbar_east__pale_oak",
      materialName: "pale oak",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "ad466449d043ccdfd68a22308f95226ad9897d457e3012bd9b82d0c6674613f6",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "52fcdf0247bb90dc634741ab807d561d717a9ad88b1239cef4c2f7902fe09aac",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "0052516839b94ee314a4e3b398c8036de3790d672194987a394ee60323848539",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "01ebf42a0d6b132be2b487febb0f2228194378d40704604824f400fc8c62ee36",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "dbc0ebe68a29c6ec9024a78cc02784bb5c35c3a5e35e1e6418dfdb63d953005d",
      },
    },
    {
      id: "source-9",
      meshName: "core_estate_pavilion_breakfast_lumbar_post_west__honey_ash",
      materialName: "honey ash",
      localMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.4399999976158142, 0, 8, 1],
      worldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.4399999976158142, 0, 8, 1],
      attributes: {
        position: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "d7e55e5abc4f9b9011f92c4cafb502e44557bfdcc2395777f755c5699b5f115f",
        },
        normal: {
          type: "Float32Array",
          normalized: false,
          itemSize: 3,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "9a128f7254d411399b97c01d44c94a55fb47dc6ad99521130e98e32e9da05529",
        },
        color: {
          type: "Uint8Array",
          normalized: true,
          itemSize: 4,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "0052516839b94ee314a4e3b398c8036de3790d672194987a394ee60323848539",
        },
        color_1: {
          type: "Uint16Array",
          normalized: true,
          itemSize: 4,
          count: 40,
          gpuType: 1015,
          usage: 35044,
          wholeSHA256: "6b816081d837004468b14b0ea2a60eafeab207dac53f9573da6c535b5923995e",
        },
      },
      index: {
        type: "Uint32Array",
        normalized: false,
        gpuType: 1015,
        usage: 35044,
        wholeSHA256: "b67efd83cca273339dcda10ca032bec97fd4a786c3c9d3146094618133081b9e",
      },
    },
  ],
  parts: [
    {
      id: "part-0",
      source: "source-0",
      faceRanges: [
        [909, 1015],
        [7708, 7708],
      ],
      triangles: 108,
      whole: false,
      typedOrientedTriangleSHA256: "64adffc6c112bc2aa970dbf7fb996008d65a1076e1d439c3b574b9e5ef2a9ac8",
    },
    {
      id: "part-1",
      source: "source-1",
      faceRanges: [
        [100, 115],
        [252, 271],
      ],
      triangles: 36,
      whole: false,
      typedOrientedTriangleSHA256: "8ed1b75b99100957c2279d029c53fb235f09b6dad8d9af2c1859d8355fd85d17",
    },
    {
      id: "part-2",
      source: "source-1",
      faceRanges: [
        [136, 143],
        [164, 171],
        [296, 315],
      ],
      triangles: 36,
      whole: false,
      typedOrientedTriangleSHA256: "dfd743a10c76586ede42d0dd6b2632c33d3e94cb73942de215400023104bd7f6",
    },
    {
      id: "part-3",
      source: "source-1",
      faceRanges: [
        [172, 179],
        [200, 207],
        [324, 343],
      ],
      triangles: 36,
      whole: false,
      typedOrientedTriangleSHA256: "bf6b861e19ab97cf57d5a52ea677cb6f970c5baa2fb82e21c8495a3584e9ac2b",
    },
    {
      id: "part-4",
      source: "source-1",
      faceRanges: [
        [208, 215],
        [236, 243],
        [360, 379],
      ],
      triangles: 36,
      whole: false,
      typedOrientedTriangleSHA256: "a48acf5e6eb03bd649d5feb4d7074739a79a139ac2634a5bdf359e6e3ce3b31c",
    },
    {
      id: "part-5",
      source: "source-1",
      faceRanges: [
        [244, 251],
        [272, 279],
        [396, 415],
      ],
      triangles: 36,
      whole: false,
      typedOrientedTriangleSHA256: "3e78a91f6edcf0f8477b2f652e5111ebd8069d393151b84a40d57e5823fab368",
    },
    {
      id: "part-6",
      source: "source-2",
      faceRanges: [
        [187, 373],
        [1126, 1126],
      ],
      triangles: 188,
      whole: false,
      typedOrientedTriangleSHA256: "49dd89f9a403ad5eb9ef43020d5a00bf0b9dfa1bf09607164be74ff05e8c2668",
    },
    {
      id: "part-7",
      source: "source-3",
      faceRanges: [[0, 27]],
      triangles: 28,
      whole: true,
      typedOrientedTriangleSHA256: "f0d258edf5ddf37f9094d24d5d663220fd1c14821faa567a0eae9a1139ead985",
    },
    {
      id: "part-8",
      source: "source-4",
      faceRanges: [[0, 11]],
      triangles: 12,
      whole: true,
      typedOrientedTriangleSHA256: "333c8ffc62afb1f1608bf0f2193b40c34b9c669adb16bb69d1cf9c08f26002b7",
    },
    {
      id: "part-9",
      source: "source-5",
      faceRanges: [[0, 11]],
      triangles: 12,
      whole: true,
      typedOrientedTriangleSHA256: "0dcc55c5fa983c8c18d71e925e2397ae18c7bf78cf277f146078d90851c608e6",
    },
    {
      id: "part-10",
      source: "source-6",
      faceRanges: [[0, 27]],
      triangles: 28,
      whole: true,
      typedOrientedTriangleSHA256: "006cfa4c2a8fa823152837fe25b893f0ba64cb4a88e3f986352b34ffed110c40",
    },
    {
      id: "part-11",
      source: "source-7",
      faceRanges: [[0, 43]],
      triangles: 44,
      whole: true,
      typedOrientedTriangleSHA256: "70a7d78737c968c9fba564512ef83e8aa5607a632d0f0b82d839b080c2ce1960",
    },
    {
      id: "part-12",
      source: "source-8",
      faceRanges: [[0, 43]],
      triangles: 44,
      whole: true,
      typedOrientedTriangleSHA256: "3fdea6a24e00b73a54c141ae2a4711cdfee812ed08804089de7c3a0f599a0ab5",
    },
    {
      id: "part-13",
      source: "source-9",
      faceRanges: [[0, 35]],
      triangles: 36,
      whole: true,
      typedOrientedTriangleSHA256: "fe2c9b10c0d0e803511f3e2f38a6a0f5c91586ebf9f954a3aeafef97fa0d82b1",
    },
  ],
};

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hashPattern = /^[0-9a-f]{64}$/;
const bytes = (array) => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
const sameBytes = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
const sameMatrix = (matrix, expected) =>
  Array.isArray(expected) && expected.length === 16 && expected.every(Number.isFinite) && matrix.elements.every((value, i) => value === expected[i]);
const digest = async (body) =>
  Array.from(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", body)), (value) => value.toString(16).padStart(2, "0")).join("");

function attributesFor(geometry) {
  const position = geometry?.attributes?.position;
  if (
    !geometry?.isBufferGeometry ||
    !position ||
    geometry.groups.length ||
    Object.keys(geometry.morphAttributes).length ||
    geometry.drawRange.start !== 0 ||
    geometry.drawRange.count !== Infinity ||
    !geometry.index ||
    geometry.index.isInterleavedBufferAttribute ||
    geometry.index.itemSize !== 1 ||
    !["Uint16Array", "Uint32Array"].includes(geometry.index.array?.constructor.name)
  )
    return null;
  const entries = Object.entries(geometry.attributes);
  if (
    entries.some(
      ([, a]) =>
        !a.isBufferAttribute ||
        a.isInterleavedBufferAttribute ||
        a.isInstancedBufferAttribute ||
        !ArrayBuffer.isView(a.array) ||
        a.array instanceof DataView ||
        a.array instanceof BigInt64Array ||
        a.array instanceof BigUint64Array ||
        !Number.isInteger(a.itemSize) ||
        a.itemSize < 1 ||
        a.count !== position.count ||
        a.array.length !== a.count * a.itemSize
    )
  )
    return null;
  if (!position.array.every(Number.isFinite)) return null;
  return entries;
}

function typedFaces(geometry, faces, names) {
  const stride = names.reduce((n, name) => n + geometry.attributes[name].itemSize * geometry.attributes[name].array.BYTES_PER_ELEMENT, 0);
  const result = new Uint8Array(faces.length * 3 * stride);
  let cursor = 0;
  for (const face of faces)
    for (let corner = 0; corner < 3; corner++) {
      const index = geometry.index.getX(face * 3 + corner);
      for (const name of names) {
        const a = geometry.attributes[name],
          width = a.itemSize * a.array.BYTES_PER_ELEMENT;
        result.set(new Uint8Array(a.array.buffer, a.array.byteOffset + index * width, width), cursor);
        cursor += width;
      }
    }
  return result;
}

function cloneAttribute(source, array) {
  const result = new THREE.BufferAttribute(array, source.itemSize, source.normalized);
  result.name = source.name;
  result.setUsage(source.usage);
  result.gpuType = source.gpuType;
  return result;
}

function partGeometry(source, faces) {
  const ids = [...new Set(faces.flatMap((face) => [0, 1, 2].map((corner) => source.index.getX(face * 3 + corner))))].sort((a, b) => a - b);
  const remap = new Map(ids.map((id, i) => [id, i])),
    geometry = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(source.attributes)) {
    const array = new a.array.constructor(ids.length * a.itemSize);
    ids.forEach((id, i) => array.set(a.array.subarray(id * a.itemSize, (id + 1) * a.itemSize), i * a.itemSize));
    geometry.setAttribute(name, cloneAttribute(a, array));
  }
  const indices = new source.index.array.constructor(faces.length * 3);
  faces.forEach((face, i) => {
    for (let k = 0; k < 3; k++) indices[i * 3 + k] = remap.get(source.index.getX(face * 3 + k));
  });
  geometry.setIndex(cloneAttribute(source.index, indices));
  geometry.userData = { ...source.userData };
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function remainderGeometry(source, removed) {
  const geometry = new THREE.BufferGeometry(),
    indices = [];
  // Attribute objects remain shared while parked source geometry is retained.
  // Only the active index is replaced; every unowned occurrence keeps its order.
  for (const [name, a] of Object.entries(source.attributes)) geometry.setAttribute(name, a);
  for (let face = 0; face < source.index.count / 3; face++)
    if (!removed.has(face)) for (let k = 0; k < 3; k++) indices.push(source.index.getX(face * 3 + k));
  geometry.setIndex(cloneAttribute(source.index, new source.index.array.constructor(indices)));
  geometry.userData = { ...source.userData };
  geometry.boundingBox = source.boundingBox?.clone() || null;
  geometry.boundingSphere = source.boundingSphere?.clone() || null;
  return geometry;
}

function copyMesh(source, geometry, id) {
  const mesh = new THREE.Mesh(geometry, source.material);
  mesh.name = "coffee_chair_" + id;
  for (const name of [
    "castShadow",
    "receiveShadow",
    "frustumCulled",
    "renderOrder",
    "customDepthMaterial",
    "customDistanceMaterial",
    "onBeforeRender",
    "onAfterRender",
    "onBeforeShadow",
    "onAfterShadow",
  ])
    mesh[name] = source[name];
  mesh.layers.mask = source.layers.mask;
  mesh.visible = source.visible;
  mesh.userData = { ...source.userData, dynamic: true, coffeeChairPart: id };
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// A low-level measured-geometry seam used by numerical/lifecycle tests. Public
// metadata cannot provide this definition: createCoffeeChair selects NATIVE.
// No source graph/geometry write occurs during asynchronous fingerprinting.
export async function createMeasuredCoffeeChair(root, definition) {
  if (
    !root?.isObject3D ||
    !record(definition) ||
    !Array.isArray(definition.sources) ||
    !Array.isArray(definition.parts) ||
    !definition.sources.length ||
    !definition.parts.length ||
    definition.sources.length > 14 ||
    definition.parts.length > 14 ||
    !Number.isFinite(definition.maxOffset) ||
    definition.maxOffset <= 0 ||
    definition.maxOffset > 0.4 ||
    !globalThis.crypto?.subtle
  )
    return null;
  try {
    definition = structuredClone(definition);
  } catch {
    return null;
  }
  root.updateWorldMatrix(true, true);
  if (!root.matrixWorld.elements.every(Number.isFinite) || root.matrixWorld.determinant() === 0) return null;
  const sources = new Map(),
    sourceMeshes = new Set(),
    parts = [],
    rootMatrix = root.matrixWorld.clone(),
    rootInverse = rootMatrix.clone().invert();
  for (const spec of definition.sources) {
    if (
      !record(spec) ||
      typeof spec.id !== "string" ||
      sources.has(spec.id) ||
      typeof spec.meshName !== "string" ||
      typeof spec.materialName !== "string" ||
      !record(spec.attributes) ||
      !record(spec.index)
    )
      return null;
    const matches = [];
    root.traverse((object) => {
      if (object.name === spec.meshName) matches.push(object);
    });
    if (matches.length !== 1) return null;
    const mesh = matches[0],
      geometry = mesh.geometry,
      attributes = attributesFor(geometry);
    if (
      sourceMeshes.has(mesh) ||
      !mesh.isMesh ||
      mesh.children.length ||
      mesh.isSkinnedMesh ||
      mesh.isInstancedMesh ||
      !mesh.visible ||
      !attributes ||
      Array.isArray(mesh.material) ||
      mesh.material?.name !== spec.materialName ||
      !sameMatrix(mesh.matrix, spec.localMatrix) ||
      !sameMatrix(mesh.matrixWorld, spec.worldMatrix)
    )
      return null;
    const capturedAttributes = attributes.map(([name, a]) => ({
      name,
      attribute: a,
      array: a.array,
      body: bytes(a.array).slice(),
      itemSize: a.itemSize,
      count: a.count,
      normalized: a.normalized,
      usage: a.usage,
      gpuType: a.gpuType,
      version: a.version,
      bufferName: a.name,
    }));
    const index = geometry.index,
      indexArray = index.array,
      indexBytes = bytes(indexArray).slice(),
      indexVersion = index.version,
      indexSchema = { itemSize: index.itemSize, count: index.count, normalized: index.normalized, usage: index.usage, gpuType: index.gpuType },
      local = mesh.matrix.clone(),
      world = mesh.matrixWorld.clone(),
      parent = mesh.parent,
      visible = mesh.visible,
      material = mesh.material;
    for (const [name, expected] of Object.entries(spec.attributes)) {
      const a = capturedAttributes.find((a) => a.name === name);
      if (
        !record(expected) ||
        !a ||
        !hashPattern.test(expected.wholeSHA256) ||
        a.array.constructor.name !== expected.type ||
        a.itemSize !== expected.itemSize ||
        a.count !== expected.count ||
        a.normalized !== expected.normalized ||
        a.usage !== expected.usage ||
        a.gpuType !== expected.gpuType ||
        (await digest(a.body)) !== expected.wholeSHA256
      )
        return null;
    }
    if (
      !hashPattern.test(spec.index.wholeSHA256) ||
      index.array.constructor.name !== spec.index.type ||
      index.normalized !== spec.index.normalized ||
      index.usage !== spec.index.usage ||
      index.gpuType !== spec.index.gpuType ||
      index.count % 3 ||
      !index.array.every((id) => id < geometry.attributes.position.count) ||
      (await digest(indexBytes)) !== spec.index.wholeSHA256
    )
      return null;
    sourceMeshes.add(mesh);
    sources.set(spec.id, {
      spec,
      mesh,
      geometry,
      material,
      parent,
      visible,
      local,
      world,
      index,
      indexArray,
      indexBytes,
      indexVersion,
      indexSchema,
      attributes: capturedAttributes,
      removed: new Set(),
      whole: false,
    });
  }
  const ids = new Set();
  for (const spec of definition.parts) {
    const source = sources.get(spec?.source);
    if (
      !record(spec) ||
      !source ||
      typeof spec.id !== "string" ||
      ids.has(spec.id) ||
      !Array.isArray(spec.faceRanges) ||
      !Number.isInteger(spec.triangles) ||
      spec.triangles <= 0 ||
      typeof spec.whole !== "boolean" ||
      !hashPattern.test(spec.typedOrientedTriangleSHA256)
    )
      return null;
    ids.add(spec.id);
    const faces = [];
    for (const range of spec.faceRanges) {
      if (
        !Array.isArray(range) ||
        range.length !== 2 ||
        !range.every(Number.isInteger) ||
        range[0] < 0 ||
        range[1] < range[0] ||
        range[1] >= source.index.count / 3
      )
        return null;
      for (let i = range[0]; i <= range[1]; i++) {
        if (source.removed.has(i)) return null;
        source.removed.add(i);
        faces.push(i);
      }
    }
    if (
      faces.length !== spec.triangles ||
      spec.whole !== (faces.length * 3 === source.index.count) ||
      (await digest(typedFaces(source.geometry, faces, Object.keys(source.spec.attributes).sort()))) !== spec.typedOrientedTriangleSHA256
    )
      return null;
    if (spec.whole) source.whole = true;
    parts.push({ spec, source, faces, local: rootInverse.clone().multiply(source.world) });
  }
  if ([...sources.values()].some((source) => !source.removed.size)) return null;

  let active = null,
    available = true,
    disposed = false,
    offset = 0,
    failure = null;
  const matrix = new THREE.Matrix4(),
    translation = new THREE.Matrix4();
  function intact(full) {
    if (disposed || root.matrixWorld.elements.some((v, i) => v !== rootMatrix.elements[i])) return false;
    for (const source of sources.values()) {
      const expected = active?.remainders.get(source) || source.geometry;
      if (
        source.mesh.parent !== source.parent ||
        source.mesh.geometry !== expected ||
        source.mesh.material !== source.material ||
        !sameMatrix(source.mesh.matrix, source.local.elements) ||
        !sameMatrix(source.mesh.matrixWorld, source.world.elements)
      )
        return false;
      const names = source.attributes
        .map((a) => a.name)
        .sort()
        .join(",");
      if (
        Object.keys(source.geometry.attributes).sort().join(",") !== names ||
        Object.keys(expected.attributes).sort().join(",") !== names ||
        expected.groups.length ||
        expected.drawRange.start !== 0 ||
        expected.drawRange.count !== Infinity ||
        Object.keys(expected.morphAttributes).length
      )
        return false;
      for (const a of source.attributes) {
        if (
          source.geometry.attributes[a.name] !== a.attribute ||
          expected.attributes[a.name] !== a.attribute ||
          a.attribute.array !== a.array ||
          a.attribute.itemSize !== a.itemSize ||
          a.attribute.count !== a.count ||
          a.array.byteLength !== a.body.byteLength ||
          a.attribute.name !== a.bufferName ||
          a.attribute.normalized !== a.normalized ||
          a.attribute.usage !== a.usage ||
          a.attribute.gpuType !== a.gpuType ||
          ((full || a.attribute.version !== a.version) && !sameBytes(bytes(a.array), a.body))
        )
          return false;
      }
      if (
        source.geometry.index !== source.index ||
        source.index.array !== source.indexArray ||
        source.indexArray.byteLength !== source.indexBytes.byteLength ||
        Object.entries(source.indexSchema).some(([key, value]) => source.index[key] !== value) ||
        ((full || source.index.version !== source.indexVersion) && !sameBytes(bytes(source.index.array), source.indexBytes))
      )
        return false;
      const stamp = active?.indexStamps.get(source);
      if (
        stamp &&
        (expected.index !== stamp.index ||
          expected.index.array !== stamp.array ||
          stamp.array.byteLength !== stamp.bytes.byteLength ||
          Object.entries(stamp.schema).some(([key, value]) => expected.index[key] !== value) ||
          ((full || expected.index.version !== stamp.version) && !sameBytes(bytes(expected.index.array), stamp.bytes)))
      )
        return false;
    }
    return true;
  }
  function release(draft) {
    if (!draft) return;
    for (const [source, geometry] of draft.remainders) {
      if (source.mesh.geometry === geometry) source.mesh.geometry = source.geometry;
    }
    for (const source of sources.values()) if (source.whole && source.mesh.visible === false) source.mesh.visible = source.visible;
    if (draft.group.parent) draft.group.removeFromParent();
    for (const geometry of draft.owned) {
      // Remainders share original attribute objects; dispose only their new
      // index/VAO, never delete the original source GPU attribute buffers.
      if ([...draft.remainders.values()].includes(geometry)) for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name);
      geometry.dispose();
    }
  }
  function reset() {
    const previous = active;
    active = null;
    offset = 0;
    release(previous);
    return true;
  }
  function activate() {
    if (!intact(true)) {
      available = false;
      failure = "source changed before activation";
      return false;
    }
    const draft = { group: new THREE.Group(), remainders: new Map(), indexStamps: new Map(), owned: [], meshes: [] };
    draft.group.name = "coffee_chair_assembly";
    draft.group.userData.dynamic = true;
    draft.group.matrixAutoUpdate = false;
    try {
      for (const source of sources.values())
        if (!source.whole) {
          const geometry = remainderGeometry(source.geometry, source.removed);
          draft.remainders.set(source, geometry);
          draft.indexStamps.set(source, {
            index: geometry.index,
            array: geometry.index.array,
            version: geometry.index.version,
            schema: {
              itemSize: geometry.index.itemSize,
              count: geometry.index.count,
              normalized: geometry.index.normalized,
              usage: geometry.index.usage,
              gpuType: geometry.index.gpuType,
            },
            bytes: bytes(geometry.index.array).slice(),
          });
          draft.owned.push(geometry);
        }
      for (const part of parts) {
        const geometry = part.spec.whole ? part.source.geometry : partGeometry(part.source.geometry, part.faces);
        if (!part.spec.whole) draft.owned.push(geometry);
        const mesh = copyMesh(part.source.mesh, geometry, part.spec.id);
        mesh.matrix.copy(part.local);
        draft.group.add(mesh);
        draft.meshes.push({ mesh, source: part.source });
      }
      // Commit only after every allocation and source guard has succeeded.
      if (!intact(true)) throw new Error("source changed during extraction");
      for (const [source, geometry] of draft.remainders) source.mesh.geometry = geometry;
      for (const source of sources.values()) if (source.whole) source.mesh.visible = false;
      root.add(draft.group);
      active = draft;
      return true;
    } catch (error) {
      release(draft);
      available = false;
      failure = "activation failed: " + String(error?.message || error);
      return false;
    }
  }
  root.updateWorldMatrix(true, true);
  if (!intact(true)) return null;
  return {
    get available() {
      return available && !disposed;
    },
    setOffset(value) {
      if (disposed || !available) return false;
      if (!Number.isFinite(value) || value < 0 || value > definition.maxOffset) {
        reset();
        return false;
      }
      if (value === 0) return reset();
      root.updateWorldMatrix(true, true);
      if (!active && !activate()) return false;
      if (!intact(false)) {
        reset();
        available = false;
        failure = "source changed while active";
        return false;
      }
      if (value !== offset) {
        translation.makeTranslation(0, 0, value);
        matrix.copy(rootInverse).multiply(translation).multiply(rootMatrix);
        active.group.matrix.copy(matrix);
        active.group.matrixWorldNeedsUpdate = true;
        offset = value;
      }
      for (const { mesh, source } of active.meshes) {
        let visible = source.visible;
        for (let parent = source.parent; parent; parent = parent.parent) {
          visible &&= parent.visible;
          if (parent === root) break;
        }
        mesh.visible = visible;
      }
      active.group.updateWorldMatrix(true, true);
      return true;
    },
    reset,
    evidence() {
      return {
        available: available && !disposed,
        phase: disposed ? "disposed" : active ? "moving" : "parked",
        offset,
        parts: parts.length,
        triangles: parts.reduce((n, p) => n + p.faces.length, 0),
        additionalDraws: active ? parts.filter((p) => !p.spec.whole).length : 0,
        failure,
      };
    },
    dispose() {
      reset();
      disposed = true;
      available = false;
    },
  };
}

export async function createCoffeeChair(root, request) {
  if (!record(request) || Object.keys(request).length !== 2 || request.version !== 1 || request.id !== "pavilion-chair-v1") return null;
  return createMeasuredCoffeeChair(root, NATIVE);
}
