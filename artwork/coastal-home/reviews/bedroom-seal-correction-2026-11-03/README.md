# Review-manifest newline correction

Before publication, Python's Windows text output left CRLF in two self-excluded review manifests. Their exact original bytes are retained here. The working manifests were copied from their already staged LF blobs, matching the successful full build's LF source projection. No payload, stored digest or numerical value was regenerated. All 60 root and staged payloads independently match the original stored hashes. Both canonical manifests pass Prettier. The binary attribute preserves the retained originals through Git.
