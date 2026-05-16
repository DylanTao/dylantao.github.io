# Sirui Visitor Worker

This Worker backs the secret page current-visitor readout.

1. Create a KV namespace:

   ```bash
   npx wrangler kv namespace create VISIT_LOG
   npx wrangler kv namespace create VISIT_LOG --preview
   ```

2. Replace the placeholder IDs in `wrangler.toml`.
3. Deploy:

   ```bash
   npx wrangler deploy
   ```

4. Set `sirui_visitor_endpoint` in `_config.yml` to the deployed `/visit` URL.

Stored visit records expire after 7 days. There is no public route that lists KV logs.
