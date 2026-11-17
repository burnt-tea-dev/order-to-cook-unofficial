# SPDX-License-Identifier: GPL-3.0-only
"""Bake the pinned, numeric drive clips before segmented player retargeting.

GeckoLib 4.8.3 BakedAnimationsAdapter expands Bedrock ``pre`` at t-0.001
seconds, and its addSplineArgs uses the preceding frame's END as Catmull's
first anchor. This is the current interval's start, not the older point
normally chosen for a Catmull-Rom spline. The destination frame owns easing.
See the frozen source in docs/validation/visual-audio/placement-poses-20261109/
source/gecko/{BakedAnimationsAdapter,EasingType}.java.

This deliberately accepts only the numeric forms/curves reviewed for the five
drive clips. It does not replace the general converter's animation sampler.
The resulting linear keys are exact at 20 TPS and all source/expanded knots;
between them they approximate the source curve. No runtime clock is inferred.
"""
import copy
import math
from fractions import Fraction


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"Drive animation requires finite numeric values: {value!r}")
    return float(value)


def _vector(value):
    if isinstance(value, (int, float)):
        value = [value] * 3
    if not isinstance(value, list) or len(value) != 3:
        raise ValueError(f"Drive animation requires a three-component vector: {value!r}")
    return tuple(_number(component) for component in value)


def _frame(time, value):
    easing, args = 'linear', ()
    if isinstance(value, dict):
        if set(value) - {'vector', 'easing', 'easingArgs'} or 'vector' not in value:
            raise ValueError(f"Unsupported drive keyframe: {value!r}")
        easing = value.get('easing', 'linear')
        raw_args = value.get('easingArgs', [])
        if not isinstance(raw_args, list):
            raise ValueError('Drive easingArgs must be a numeric list')
        args = tuple(_number(arg) for arg in raw_args)
        value = value['vector']
    modes = {'linear': 'linear', 'none': 'linear', 'catmullrom': 'catmullrom',
             'easeoutelastic': 'easeOutElastic'}
    if not isinstance(easing, str) or easing.lower() not in modes:
        raise ValueError(f"Unsupported drive easing: {easing!r}")
    return (time, _vector(value), modes[easing.lower()], args)


def _bedrock_vector(value):
    # extractBedrockKeyframe strips nested metadata before constructing a new
    # frame; in the pinned clips pre/post both contain a {vector: [...]} object.
    if isinstance(value, dict):
        for key in ('vector', 'pre', 'post'):
            if key in value:
                value = value[key]
                break
    return list(_vector(value))


def _decode_channel(channel):
    if not isinstance(channel, dict) or 'vector' in channel:
        return [_frame(0.0, channel)]
    frames = []
    for key, value in channel.items():
        time = float(key)
        if not math.isfinite(time) or time < 0:
            raise ValueError(f"Invalid drive keyframe time: {key!r}")
        if isinstance(value, dict) and 'vector' not in value:
            if set(value) - {'pre', 'post', 'lerp_mode'} or not {'pre', 'post'} & set(value):
                raise ValueError(f"Unsupported drive pre/post keyframe: {value!r}")
            if 'pre' in value:
                frames.append(_frame(time - .001 if time else 0.0, _bedrock_vector(value['pre'])))
            if 'post' in value:
                frames.append(_frame(time, {'vector': _bedrock_vector(value['post']),
                    'easing': value.get('lerp_mode', 'linear')}))
        else:
            frames.append(_frame(time, value))
    # The Java adapter consumes authored order. Do not silently sort an invalid
    # or newly introduced zero-duration jump into a different interpretation.
    if not frames or frames[0][0] < 0 or any(a[0] >= b[0] for a, b in zip(frames, frames[1:])):
        raise ValueError('Drive keyframes must have increasing expanded times')
    return frames


def _sample(frames, seconds, easing_fraction):
    for index, (end_time, end, easing, args) in enumerate(frames):
        if seconds <= end_time:
            start_time, start = frames[index - 1][:2] if index else (0.0, end)
            if seconds == end_time or end_time == start_time:
                return list(end)
            fraction = (seconds - start_time) / (end_time - start_time)
            if easing == 'catmullrom' and len(frames) > 1:
                following = frames[index + 1][1] if index + 1 < len(frames) else end
                # addSplineArgs: p0 == p1, p2 == end, p3 == next end.
                return [.5 * (2*a + (b-a)*fraction
                    + (-3*a+4*b-c)*fraction**2 + (2*a-3*b+c)*fraction**3)
                    for a, b, c in zip(start, end, following)]
            fraction = easing_fraction(easing, fraction, args)
            return [a + (b-a)*fraction for a, b in zip(start, end)]
    return list(frames[-1][1])


def bake_drive_clip(original, easing_fraction):
    """Preserve clip metadata; replace numeric channels with bounded linear keys.

    ``easing_fraction`` is the converter's already source-verified Gecko elastic
    implementation. Keeping it as a callback avoids a second elastic formula.
    Constant channels collapse after decoding, but their source times still
    participate in the shared sample grid for the other channels.
    """
    duration = _number(original['animation_length'])
    if duration <= 0:
        raise ValueError('Drive animation_length must be positive')
    decoded = {}
    times = {0.0, duration, *(tick / 20 for tick in range(math.floor(duration * 20) + 1))}
    for bone, channels in original['bones'].items():
        if set(channels) - {'rotation', 'position', 'scale'}:
            raise ValueError(f"Unsupported drive bone channels: {bone}")
        for channel, value in channels.items():
            frames = _decode_channel(value)
            decoded[bone, channel] = frames
            times.update(time for time, *_ in frames if 0 <= time <= duration)
    times = sorted(times)
    result = copy.deepcopy(original)
    for (bone, channel), frames in decoded.items():
        if all(frame[1] == frames[0][1] for frame in frames):
            value = list(frames[0][1])
        else:
            value = {f'{time:.12g}': _sample(frames, time, easing_fraction) for time in times}
        result['bones'][bone][channel] = value
    return result


def compact_linear_bones(bones):
    """Remove only redundant keys from the final numeric riding tracks.

    Call after retargeting/rounding: removing source sample times earlier would
    change the nonlinear parent-frame conversion. Fractions use the decimal
    values actually written to JSON, so no epsilon, quantization or curve error
    budget is involved. Three exactly collinear keys describe the same linear
    function as their endpoints. Keep both endpoints of every varying track.

    Constant tracks starting at zero become constant vectors. Keep every bone,
    channel and neutral value; those still participate in animation blending.
    Native floating-point evaluation may round differently between retained
    keys, but the represented piecewise-linear function is unchanged.
    """
    result = copy.deepcopy(bones)
    for bone, channels in result.items():
        if set(channels) - {'rotation', 'position', 'scale'}:
            raise ValueError(f"Unsupported numeric riding bone channels: {bone}")
        for channel, value in channels.items():
            if not isinstance(value, dict):
                _vector(value)
                continue
            frames = []
            for key, vector in value.items():
                _number(float(key))
                time = Fraction(key)
                _vector(vector)
                numbers = vector if isinstance(vector, list) else [vector] * 3
                exact = tuple(Fraction(str(component)) for component in numbers)
                if time < 0 or frames and time <= frames[-1][2]:
                    raise ValueError('Numeric riding keyframes must have increasing nonnegative times')
                frames.append((key, vector, time, exact))
            if not frames:
                raise ValueError('Numeric riding tracks cannot be empty')
            if frames[0][2] == 0 and all(frame[3] == frames[0][3] for frame in frames):
                channels[channel] = frames[0][1]
                continue
            kept = []
            for frame in frames:
                kept.append(frame)
                while len(kept) >= 3:
                    a, b, c = kept[-3:]
                    if not all((bv-av)*(c[2]-a[2]) == (cv-av)*(b[2]-a[2])
                               for av, bv, cv in zip(a[3], b[3], c[3])):
                        break
                    kept.pop(-2)
            channels[channel] = {key: vector for key, vector, *_ in kept}
    return result
