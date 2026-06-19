# Monitoring Architecture

The Rust monitor observes active-window changes and idle state while a session is active. `RuleEngine` classifies windows. A one-second ticker accumulates focus, distraction, and idle time, persists heartbeats, emits frontend ticks, and evaluates alerts even when the active window does not change. Suspiciously long scheduler gaps pause recovery rather than inventing elapsed time.

Window titles can contain sensitive data and remain local. LazyNevis/system UI remains ignored. Alert cooldown is global, overlays are pre-created, and `AudioPlayer` retains `rodio::OutputStream` inside its OS thread. Platform limitations are described in troubleshooting docs and capability specs.
