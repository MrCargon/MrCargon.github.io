# SineMotion.gd — procedural character animation from sine waves. No .anim files,
# no imported animation data, no AnimationPlayer.
#
# WHY THIS EXISTS
# The "no assets" approach usually dies on animation: you can generate terrain and
# materials procedurally, but a capsule that slides around reads as broken. The way
# out is the same one the sine-wave project used in 2D — generate the MOTION too.
#
# In 2D that was interpolating Fourier coefficients. In 3D the direct equivalent is
# driving joint rotations with phase-offset sine waves. A walk cycle is:
#
#     angle(joint) = amplitude * sin(phase_of_cycle + offset_for_that_joint)
#
# Legs are half a cycle apart, arms counter-swing against the legs, the torso bobs at
# twice the cycle rate (two steps per stride), and everything scales with speed. That
# is a walk cycle in about a dozen numbers.
#
# WHY IT MATTERS FOR MULTIPLAYER SPECIFICALLY
# A replicated character needs only its position, facing and a single cycle PHASE
# float. Every client regenerates identical limb positions from that phase — no
# animation state machine to sync, no risk of clients disagreeing about which frame
# is playing, and a few bytes per tick instead of a bone stream.
#
# Attach to a CharacterBody3D that has a Skeleton3D child.
extends CharacterBody3D

@export var walk_cycle_hz: float = 1.6      # strides per second at full speed
@export var max_speed: float = 5.0
@export var hip_swing_deg: float = 28.0
@export var knee_bend_deg: float = 34.0
@export var arm_swing_deg: float = 22.0
@export var torso_bob: float = 0.055        # metres
@export var breathe_hz: float = 0.25        # idle motion so a standing character lives

# Bone names — rename to match your rig.
@export var bone_hip_l: String = "UpperLeg.L"
@export var bone_hip_r: String = "UpperLeg.R"
@export var bone_knee_l: String = "LowerLeg.L"
@export var bone_knee_r: String = "LowerLeg.R"
@export var bone_arm_l: String = "UpperArm.L"
@export var bone_arm_r: String = "UpperArm.R"
@export var bone_torso: String = "Spine"

var _skel: Skeleton3D
var _phase: float = 0.0                     # THE replicated value: 0..TAU
var _rest: Dictionary = {}                  # bone_idx -> rest Transform3D


func _ready() -> void:
	_skel = _find_skeleton(self)
	assert(_skel != null, "SineMotion: needs a Skeleton3D child")
	# Cache rest poses once. Every frame we set pose = rest * generated_rotation, so
	# the rig's own proportions are preserved and we never accumulate drift.
	for name in [bone_hip_l, bone_hip_r, bone_knee_l, bone_knee_r,
			bone_arm_l, bone_arm_r, bone_torso]:
		var idx := _skel.find_bone(name)
		if idx != -1:
			_rest[idx] = _skel.get_bone_pose(idx)


func _find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node
	for child in node.get_children():
		var found := _find_skeleton(child)
		if found != null:
			return found
	return null


func _physics_process(delta: float) -> void:
	var speed := Vector2(velocity.x, velocity.z).length()
	var speed01: float = clampf(speed / max_speed, 0.0, 1.0)

	# Advance the cycle in proportion to SPEED, not to time. This is what makes the
	# feet appear to grip the ground instead of skating: at half speed the legs swing
	# at half the rate. A fixed-rate animation clip cannot do this without retiming.
	_phase = fmod(_phase + TAU * walk_cycle_hz * speed01 * delta, TAU)

	_apply_pose(speed01, delta)


# All the actual animation. Roughly forty lines, and it replaces every walk/idle
# animation asset the character would otherwise need.
func _apply_pose(speed01: float, delta: float) -> void:
	if _skel == null:
		return

	var t := Time.get_ticks_msec() / 1000.0
	# Idle never fully stops — a perfectly still character reads as a frozen bug.
	var idle := sin(t * TAU * breathe_hz) * 0.35 * (1.0 - speed01)

	# Legs: half a cycle apart, which is the definition of a walk.
	var hip_l := sin(_phase) * deg_to_rad(hip_swing_deg) * speed01
	var hip_r := sin(_phase + PI) * deg_to_rad(hip_swing_deg) * speed01

	# Knees only bend one way, so rectify the sine and offset it a quarter cycle so the
	# bend peaks as the leg passes under the body. A raw sine here bends knees backwards
	# for half the stride, which is the single most common tell of a bad procedural walk.
	var knee_l := maxf(0.0, sin(_phase - PI * 0.5)) * deg_to_rad(knee_bend_deg) * speed01
	var knee_r := maxf(0.0, sin(_phase + PI * 0.5)) * deg_to_rad(knee_bend_deg) * speed01

	# Arms counter-swing against the opposite leg. Free-looking but it is real
	# biomechanics: it cancels the torso's angular momentum.
	var arm_l := sin(_phase + PI) * deg_to_rad(arm_swing_deg) * speed01
	var arm_r := sin(_phase) * deg_to_rad(arm_swing_deg) * speed01

	_rotate_bone(bone_hip_l, Vector3.RIGHT, hip_l)
	_rotate_bone(bone_hip_r, Vector3.RIGHT, hip_r)
	_rotate_bone(bone_knee_l, Vector3.RIGHT, knee_l)
	_rotate_bone(bone_knee_r, Vector3.RIGHT, knee_r)
	_rotate_bone(bone_arm_l, Vector3.RIGHT, arm_l + idle * 0.1)
	_rotate_bone(bone_arm_r, Vector3.RIGHT, arm_r - idle * 0.1)
	# Torso bobs at DOUBLE the stride rate: two footfalls per full cycle.
	_rotate_bone(bone_torso, Vector3.RIGHT, sin(_phase * 2.0) * 0.05 * speed01 + idle * 0.02)

	var idx := _skel.find_bone(bone_torso)
	if idx != -1 and _rest.has(idx):
		var xf: Transform3D = _skel.get_bone_pose(idx)
		xf.origin = (_rest[idx] as Transform3D).origin \
			+ Vector3(0.0, absf(sin(_phase)) * torso_bob * speed01, 0.0)
		_skel.set_bone_pose(idx, xf)


func _rotate_bone(bone_name: String, axis: Vector3, angle: float) -> void:
	var idx := _skel.find_bone(bone_name)
	if idx == -1 or not _rest.has(idx):
		return
	var rest: Transform3D = _rest[idx]
	# Compose against REST, never against the current pose — composing against current
	# integrates floating-point error every frame and the rig slowly corkscrews.
	_skel.set_bone_pose(idx, Transform3D(rest.basis * Basis(axis, angle), rest.origin))


# ---- multiplayer -----------------------------------------------------------
# The entire animation state is one float. Send this; do not replicate bone poses.
func get_replication_state() -> Dictionary:
	return {
		"pos": global_position,
		"yaw": rotation.y,
		"phase": _phase,
	}


func apply_replication_state(state: Dictionary) -> void:
	assert(state.has("phase"), "SineMotion: phase required in replication state")
	global_position = state.get("pos", global_position)
	rotation.y = state.get("yaw", rotation.y)
	# Interpolate the SHORT way around the cycle, or a character crossing the TAU
	# boundary snaps its legs backwards through a whole stride.
	var target: float = state["phase"]
	var d: float = fmod(target - _phase + PI * 3.0, TAU) - PI
	_phase = fmod(_phase + d * 0.35 + TAU, TAU)
