(
var telemetryPort = 57121;
var portFromEnvironment = "MATERIALITY_OSC_PORT".getenv;
var maxVoices = 6;

if(portFromEnvironment.notNil, {
    telemetryPort = portFromEnvironment.asInteger;
});

Server.default = Server.local;
s = Server.default;

// The piece listens to system telemetry, not microphone audio.
// Disabling input also avoids mismatched input/output sample rates on macOS.
s.options.numInputBusChannels = 0;
s.options.numOutputBusChannels = 2;

s.waitForBoot({
    SynthDef(\materialityBed, {
        |out = 0, cpu = 0.2, memory = 0.4, load = 0.2,
        processes = 0.3, battery = 0.5, lag = 0.0|

        var fundamental;
        var subFrequency;
        var rustleCutoff;
        var drift;
        var drone;
        var hum;
        var rumble;
        var rustle;
        var pulse;
        var signal;

        fundamental = (28 + (memory * 12)).midicps;
        subFrequency = fundamental * (0.48 + (load * 0.08));
        rustleCutoff = 220 + (memory * 5200) + (processes * 2200);
        drift = LFNoise2.kr(0.02 + (lag * 0.35)).range(-1, 1);

        drone = SinOsc.ar(
            fundamental * [1, 1.003 + (load * 0.012)],
            drift * pi,
            0.055
        );
        hum = SinOsc.ar(
            subFrequency * [1, 1.006 + (load * 0.01)],
            0,
            0.028 + (load * 0.018)
        );
        rumble = LPF.ar(
            BrownNoise.ar(0.045 ! 2),
            65 + (load * 150)
        );
        rustle = LPF.ar(
            PinkNoise.ar(0.038 ! 2),
            rustleCutoff
        );
        pulse = SinOsc.kr(
            0.025 + (battery * 0.12)
        ).range(0.25, 0.9);

        signal = Splay.ar(drone, 0.7) + hum + rumble + (rustle * pulse);
        signal = signal * (0.9 - (cpu * 0.3));

        Out.ar(out, LeakDC.ar(signal));
    }).add;

    SynthDef(\materialityVoice, {
        |out = 0, gate = 1, amp = 0.16, index = 0,
        cpu = 0.2, memory = 0.4, load = 0.2,
        processes = 0.3, battery = 0.5, lag = 0.0|

        var drift;
        var frequency;
        var clickRate;
        var trigger;
        var clickEnvelope;
        var exciter;
        var resonated;
        var ping;
        var tone;
        var envelope;
        var pan;
        var signal;

        drift = LFNoise2.kr(0.025 + (lag * 0.45)).range(-1, 1);
        frequency = (
            33
            + (index * 4)
            + (memory * 11)
            + (drift * (1.5 + (load * 5)))
        ).midicps;
        clickRate = 0.25 + (processes * 6) + (cpu * 2);

        // Decay2.ar requires an audio-rate trigger. Dust.ar is intentional.
        trigger = Dust.ar(clickRate);
        clickEnvelope = Decay2.ar(
            trigger,
            0.0015,
            0.025 + (memory * 0.16)
        );
        exciter = clickEnvelope * WhiteNoise.ar(0.5);

        resonated = Ringz.ar(
            exciter,
            frequency * [1, 1.42 + (load * 0.2)],
            0.18 + ((1 - cpu) * 1.35)
        ).sum * 0.11;

        ping = SinOsc.ar(
            frequency * [1, 1.004 + (load * 0.01)],
            0,
            clickEnvelope * 0.07
        ).sum;

        tone = SinOsc.ar(
            frequency * [1, 1.001 + (load * 0.01)],
            drift,
            0.035
        ).sum;

        envelope = EnvGen.kr(
            Env.asr(2.5, 1, 4),
            gate,
            doneAction: 2
        );
        pan = ((index / 5) * 1.7 - 0.85 + (drift * 0.1)).clip(-1, 1);
        signal = (resonated + ping + tone) * envelope * amp;

        Out.ar(out, Pan2.ar(LeakDC.ar(signal), pan));
    }).add;

    SynthDef(\materialityMaster, {
        |in = 0, out = 0, gain = 0.9|

        var signal = In.ar(in, 2);

        signal = LeakDC.ar(signal).tanh * gain;
        Out.ar(out, Limiter.ar(signal, 0.65, 0.01));
    }).add;

    s.sync;

    ~materialityBus = Bus.audio(s, 2);
    ~materialityGroup = Group.head(s);
    ~materialityMaster = Synth.after(
        ~materialityGroup,
        \materialityMaster,
        [\in, ~materialityBus, \out, 0]
    );
    ~materialityBed = Synth.head(
        ~materialityGroup,
        \materialityBed,
        [\out, ~materialityBus]
    );
    ~materialityVoices = List.new;

    ~setVoiceCount = { |target|
        var index;
        var synth;

        target = target.asInteger.clip(1, maxVoices);

        (target - ~materialityVoices.size).max(0).do({
            index = ~materialityVoices.size;
            synth = Synth.tail(
                ~materialityGroup,
                \materialityVoice,
                [\out, ~materialityBus, \index, index]
            );
            ~materialityVoices.add(synth);
        });

        (~materialityVoices.size - target).max(0).do({
            synth = ~materialityVoices.removeAt(
                ~materialityVoices.size - 1
            );
            synth.set(\gate, 0);
        });
    };

    ~setVoiceCount.(3);

    OSCdef(
        \materialitySystem,
        { |message|
            var cpu = message[1].asFloat.clip(0, 1);
            var memory = message[2].asFloat.clip(0, 1);
            var load = message[3].asFloat.clip(0, 1);
            var processes = message[4].asFloat.clip(0, 1);
            var battery = message[5].asFloat.clip(0, 1);
            var lag = message[6].asFloat.clip(0, 1);
            var voiceCount;
            var controls;

            voiceCount = (
                1 + ((1 - cpu) * (maxVoices - 1))
            ).round.asInteger;

            controls = [
                \cpu, cpu,
                \memory, memory,
                \load, load,
                \processes, processes,
                \battery, battery,
                \lag, lag
            ];

            ~setVoiceCount.(voiceCount);
            ~materialityBed.set(*controls);
            ~materialityVoices.do({ |voice|
                voice.set(*controls);
            });
        },
        "/materiality/system",
        recvPort: telemetryPort
    );

    "Materialität audio engine online — OSC port %."
        .format(telemetryPort)
        .postln;
});
)
