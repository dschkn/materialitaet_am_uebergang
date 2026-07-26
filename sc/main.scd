(
var telemetryPort = 57121;
var portFromEnvironment = "MATERIALITY_OSC_PORT".getenv;
var maxVoices = 6;
var lastReport = 0;

if(portFromEnvironment.notNil, {
    telemetryPort = portFromEnvironment.asInteger;
});

Server.default = Server.local;
s = Server.default;

s.waitForBoot({
    SynthDef(\materialityBed, {
        |out = 0, cpu = 0.2, memory = 0.4, load = 0.2,
        processes = 0.3, battery = 0.5, lag = 0.0|

        var fundamental;
        var drift;
        var drone;
        var air;
        var pulse;
        var signal;

        fundamental = (31 + (memory * 14)).midicps;
        drift = LFNoise2.kr(0.03 + (lag * 0.4)).range(-1, 1);
        drone = SinOsc.ar(
            fundamental * [1, 1.005 + (load * 0.02)],
            drift * pi,
            0.045
        );
        air = LPF.ar(
            PinkNoise.ar(0.035),
            250 + (memory * 6500) + (processes * 1800)
        );
        pulse = SinOsc.kr(0.025 + (battery * 0.12)).range(0.35, 1);
        signal = Splay.ar(drone, 0.65) + ((air ! 2) * pulse);
        signal = signal * (0.85 - (cpu * 0.25));

        Out.ar(out, Limiter.ar(LeakDC.ar(signal), 0.7));
    }).add;

    SynthDef(\materialityVoice, {
        |out = 0, gate = 1, amp = 0.09, index = 0,
        cpu = 0.2, memory = 0.4, load = 0.2,
        processes = 0.3, battery = 0.5, lag = 0.0|

        var drift;
        var frequency;
        var trigger;
        var exciter;
        var resonated;
        var tone;
        var envelope;
        var pan;
        var signal;

        drift = LFNoise2.kr(0.025 + (lag * 0.45)).range(-1, 1);
        frequency = (
            38
            + (index * 5)
            + (memory * 12)
            + (drift * (2 + (load * 7)))
        ).midicps;

        trigger = Dust.kr(0.3 + (processes * 7) + (cpu * 2));
        exciter = Decay2.ar(
            trigger,
            0.004,
            0.06 + (memory * 0.35)
        ) * PinkNoise.ar(0.45);

        resonated = Ringz.ar(
            exciter,
            frequency * [1, 1.48 + (load * 0.18)],
            0.25 + ((1 - cpu) * 1.8)
        ).sum * 0.16;

        tone = SinOsc.ar(
            frequency * [1, 1.001 + (load * 0.012)],
            drift,
            0.035
        ).sum;

        envelope = EnvGen.kr(
            Env.asr(2.5, 1, 4),
            gate,
            doneAction: 2
        );
        pan = ((index / 5) * 1.7 - 0.85 + (drift * 0.1)).clip(-1, 1);
        signal = (resonated + tone) * envelope * amp;

        Out.ar(out, Pan2.ar(LeakDC.ar(signal), pan));
    }).add;

    s.sync;

    ~materialityGroup = Group.head(s);
    ~materialityBed = Synth.tail(
        ~materialityGroup,
        \materialityBed
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
                [\index, index]
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

            if((Main.elapsedTime - lastReport) > 5, {
                (
                    "materiality | voices:% cpu:% memory:% load:%"
                    .format(
                        ~materialityVoices.size,
                        cpu.round(0.01),
                        memory.round(0.01),
                        load.round(0.01)
                    )
                ).postln;
                lastReport = Main.elapsedTime;
            });
        },
        "/materiality/system",
        recvPort: telemetryPort
    );

    "Materialität am Übergang is listening on OSC port %."
        .format(telemetryPort)
        .postln;
});

s.boot;
)
