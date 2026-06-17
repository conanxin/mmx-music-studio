# BYOK Live One-Shot Pilot Success Closeout

Date: 2026-06-15

Phase: BYOK-LIVE-ONE-SHOT-PILOT-SUCCESS-CLOSEOUT

## Pilot Conclusion

SUCCESS

## Evidence

- requestId: `byok_d03e86949d9a`
- Successful stage: `direct_live_relay_ok`
- Turnstile: passed
- Generation intent: `instrumental`
- Model: `music-2.6-free`
- Live attempt cap: `1/1` consumed during the controlled one-shot pilot
- Live audio cap: `1/1` consumed during the controlled one-shot pilot
- User-visible result: BYOK direct API test passed
- MiniMax provider path: reached once during the controlled pilot

## Fix Chain Confirmed

- The provider error observability fix made the previous provider failure
  diagnosable without logging full provider bodies or sensitive material.
- The lyrics / instrumental parameter fix corrected the MiniMax `music-2.6`
  request shape for background-music style prompts by sending
  `is_instrumental=true`.
- After these fixes, the controlled direct-live one-shot pilot completed at
  `direct_live_relay_ok`.

## Production State After Pilot

Production was rolled back to safe-default after the one-shot pilot:

- `publicByokEnabled=false`
- `byokLiveEnabled=false`
- `byokLiveConfirmationConfigured=false`
- `byokLiveAttemptsRemaining=1`
- `byokLiveAudioRemaining=1`

This is still not a broad public launch. BYOK live should remain closed unless
a new operator-controlled window is explicitly prepared and preflighted.

## Follow-Up Recommendations

- Design better live window management before allowing multiple generations.
- Decide whether successful BYOK direct relay results should be written into
  Library, or remain relay-only.
- Design clearer user-level error messages for BYOK provider and validation
  failures.
- Decide whether to open a very small self-use scope, with explicit caps,
  preflight, and rollback steps.

## Sensitive Data Policy

This closeout intentionally does not record any MiniMax API key, Turnstile
token, Authorization header, secret, or confirmation value.
