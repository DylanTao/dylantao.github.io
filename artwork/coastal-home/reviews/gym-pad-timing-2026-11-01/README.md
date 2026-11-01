# Gym gamepad progress under software rendering, November 1

The preceding dialog repair is deployed. Visual run `41334965734` passed its mobile gym case but three larger gym jobs timed out waiting for a right-stick turn. The retained desktop trace records a connected controller, released input suspension and neutral gate, and a pending frame. The requested turn appears after about 17 seconds, beyond the generic 15-second assertion deadline. This is a measured slow-frame deadline failure; it does not establish a new controller runtime defect.

The existing turn assertion now uses the scene's existing readiness budget and retains every sampled Walk state, frame count and pending-frame flag before failure. It still requires actual yaw movement after the same right-stick input. Keyboard, gravity, release/neutral behavior, viewport, renderer, assets and other assertions remain intact. No product module changed for this correction.

The exact replacement passes on the complete unchanged `8ac01d3f9` product at port 4201, in independently qualified Linux/Mesa Chromium. The native clock and frame loop run normally; this functional proof is not a performance benchmark. The original three failed jobs remain failed. A subsequent complete CI run and deployed check are separate release evidence.

Compressed files contain original bytes. The selected complete trace/network streams and decoded states retain the failure evidence; the full Trace Viewer archive remains local. No claim is made that this packet contains every screencast frame or embedded asset.
