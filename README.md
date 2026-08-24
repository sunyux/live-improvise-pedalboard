# Live Improvise Film Score — Virtual Pedalboard

A browser-based virtual pedalboard for live-improvised film scoring / silent-film accompaniment.
无声电影 / 实验短片即兴配乐的网页端虚拟效果器台。

## Features 功能

- **Virtual pedalboard 虚拟效果器台** — Overdrive, Delay, Reverb built with the Web Audio API, controlled with draggable rotary knobs and footswitch bypass toggles.
- **Silent film sync 默片同步播放** — load a local video file and play it alongside your live performance.
- **Built-in demo sounds 内置示范声音** — UFO sweep, filtered noise burst, alert tone, sustained drone pad — play through the effect chain without needing an instrument.
- **Guitar pluck synthesis 吉他拨弦** — Karplus-Strong physical modeling synthesis, playable via computer keyboard or a one-click "Guitar Strum" demo (standard tuning).
- **Computer keyboard synth 键盘演奏** — plays like a piano, routes through the same effect chain.
- **Live waveform scope 实时波形** — oscilloscope-style visualization of the processed output.
- **Instrument / mic input 乐器输入** — connect a real guitar/synth via your audio interface using `getUserMedia`.
- **Performance recording 演出录制** — records the processed audio output to a downloadable `.webm` file.
- **Practice log 练习日志** — session notes persisted across visits.

## Usage 使用方法

Just open `index.html` in a modern browser (Chrome/Edge/Firefox). No build step, no dependencies beyond a CDN font load.

1. Click **启动音频引擎 / Start audio engine** (required by browser autoplay policy).
2. Try the built-in demo sounds or play the on-screen keyboard — no instrument required.
3. Toggle pedal footswitches to hear the effect chain.
4. Load a silent film clip to play alongside your performance.
5. Hit **开始录制 / Start recording** to capture a take.

## Tech notes 技术说明

- Audio DSP: native Web Audio API (`WaveShaperNode` for overdrive, `DelayNode` + feedback for delay, `ConvolverNode` with a generated impulse response for reverb, Karplus-Strong delay-feedback loop for guitar pluck synthesis).
- No external audio libraries — everything is hand-built on top of the Web Audio graph.
- Practice log persistence uses the host page's key-value storage API (not `localStorage`).

## Roadmap ideas 后续可以扩展

- Improvisation sample library (Ambient / Drone / Noise clips)
- WordPress or lightweight DB backend for the practice log
- Spectrum analyzer alongside the waveform scope
- Additional pedals (tremolo, looper, pitch shifter)

## License

MIT — do whatever you want with it.
