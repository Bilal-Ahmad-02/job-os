# Oracle desktop

For normal use, open **Oracle** through Start, its desktop shortcut or taskbar icon. The versioned
Windows executable starts its pinned Ubuntu record worker automatically. No development terminal,
HTTP service or Node/Rust toolchain is required for normal use.

Read [DEVELOPMENT.md](DEVELOPMENT.md) for current setup and test commands and
[RUNTIME_RELEASES.md](RUNTIME_RELEASES.md) for installing updates. Editing source or building an
executable does not update the installed copy. The app is a managed local installation, not a
signed new-machine installer or updater. WebView2 and Ubuntu WSL2 remain prerequisites.

## Current diagnostic and provider behavior

The **SYSTEM** drawer contains an explicitly requested optional HTTP diagnostic. It does not run
on unlock or window focus, and a diagnostic failure does not set a global disconnected state.
Record modules report their own failures over the separate authenticated Windows/WSL pipe.
The HTTP endpoint remains fixed at `http://127.0.0.1:8000/health`, with no personal data.

**05 / CONTROL** handles native key entry, Windows credential storage and explicit provider-test
permission. Saving a key never contacts the provider or enables inference. See
[provider settings](PROVIDER_SETTINGS.md).

## Building a Windows executable

From `apps/desktop` in PowerShell:

```powershell
npm.cmd run desktop:build
```

This produces `src-tauri/target/release/oracle-desktop.exe` with bundled frontend assets. Follow
RUNTIME_RELEASES.md to install it and update existing shortcuts. For development, `npm.cmd run desktop`
starts Vite and Tauri; that development window uses the same local application identity and private
runtime configuration. Use synthetic tests for mutations.

The behavior/security sections below include historical milestone notes. Current setup is described
above and in DEVELOPMENT.md; historical Windows Python examples are not instructions to reopen the
inactive Windows database or change production runtime ownership.

## Frontend structure and interactions

The 2026-09-28 frontend cleanup separates ACQ (applications) and VAULT (source documents) with
compact module navigation. The previous permanent decorative side panel is replaced by an
on-demand system drawer. Its health indicator describes the optional HTTP health service, not
whether private database operations are available. It never claims that an AI model is connected.

Switching modules keeps the application editor mounted so drafts survive navigation; locking the
workspace still unmounts all private views. Ctrl+K only acts in the active dossier index. Clearing
a query returns to the first page, and refresh recovers when a result set shrinks beyond the current
page. Document filtering is local; full checksums appear only inside the file-integrity disclosure.
Record editing uses named field groups, a persistent save bar, and explicit discard controls.

Frontend responsibilities are separated into workspace shell, system status, dossier index/editor,
source provenance, and document register. Component styles live under `src/styles/`, with shared
tokens and focus/error treatment in `base.css`. The unused rail icon and obsolete sidebar styles
were removed. Master icon artwork is retained intentionally for future icon regeneration.

The frontend tests cover navigation/draft preservation, query/pagination recovery, error redaction,
source filtering, and existing access/save behavior. The automated desktop/browser capture tools
were unavailable during this change; live visual review is still needed.

## The chamber (2026-10-05)

Unlocking now opens a hub instead of the Job OS console. It is a black void with a green
perspective floor grid (CSS only, no new assets or dependencies). The centre shows the existing
emblem as **ORACLE / MASTER**, labelled **DORMANT** with "No assistant yet. Nothing is running
here." That label is literal: no assistant, model or background activity exists behind it, and the
slow floor drift is decoration that stops under `prefers-reduced-motion`.

One node is real: **01 / JOB.OS**, described as a manual console with no automation. Activating it
(click, Enter or Space) opens the existing console with all five modules unchanged. The other three
positions are non-interactive **UNASSIGNED** empty slots; they name nothing and promise nothing.

The console header has a **Chamber** control that returns to the hub; **Lock Oracle** is available
in both places. The console is mounted on its first opening rather than at unlock, so record
requests start only after JOB.OS is chosen. It then stays mounted but hidden while the hub is shown,
so in-memory drafts survive a return. Locking still unmounts everything. Ctrl+K is ignored while
the console is hidden. Below 760 px wide or 520 px tall the board stacks into one scrolling column.

Correction, 2026-10-05: the first hub release left the hub visible above the console, because the
hub's `display: grid` overrode the `hidden` attribute. `.chamber[hidden]` now hides it. Component
tests could not catch this; they do not apply stylesheets.

`Chamber.tsx` owns the hub and the hub/console switch; `AccessGate` renders it after native unlock.
No native command, capability, backend operation or schema changed.

Validation: 89 frontend tests, TypeScript, Biome, Vite and the Tauri production build passed. Tests
cover the hub after unlock, the dormant label, the single interactive node, opening and returning
with state and focus preserved, and locking from both places. The hub was viewed once in a browser
preview of the component at the default 1100x760 size. The narrow layout, the installed window after
a real unlock and the real console behind the hub were not visually checked.

## The chamber scene (2026-10-05, second version)

The owner asked for the hub to become an interactive, isometric pixel scene seen from the angle of
a reference image they supplied, in Oracle's dark palette. This replaces the flat board described
above; the hub/console switch, the Chamber return control and locking are unchanged.

What is drawn (`src/chamber/`, original SVG, no image files, no new dependency):

- A cross-shaped court over dark space with green stars and grid lines drifting along the court's
  own axes.
- Two hourglasses whose sand drains and refills on a 24-second loop.
- The core in the middle: a seated machine figure at a console under a wire dome, with a dim orb
  above it. It is labelled **ORACLE / MASTER — DORMANT — No assistant yet. Nothing is running
  here.** The screen is dark and the orb does not pulse.
- One walking figure, a coated investigator, for the one real module. It is a real button named
  "Open JOB.OS console", tagged "01 / JOB.OS — Job search / manual, no automation". A dotted
  tether runs from the orb to its feet and follows it as it walks. Pointing at it or focusing it
  with the keyboard stops it so it can be pressed.
- Three empty pads labelled UNASSIGNED. They are not interactive.

Deliberate limits:

- Only modules that exist get a figure. More figures appear when more modules do; none is drawn
  for a planned one. The tether is a static dotted line, not a pulse or a data flow, because
  nothing passes between a dormant core and a manual console.
- The owner asked for figures of specific film and comic characters. The figures drawn here are
  original designs that fit each role, not likenesses of those characters, because this repository
  is public and those characters belong to their publishers. Private, owner-supplied sprites kept
  out of Git would be a separate change.
- **Motion switch.** The scene moves only when the hub is marked on. It starts from the system's
  reduced-motion preference, and a **Motion on/off** button in the hub header lets the owner
  override it; the choice is kept in the app's local storage. On this PC Windows "Animation
  effects" is off, so the scene starts still and the owner must switch motion on once. All
  animation rules are scoped to that switch.

Validation: 113 frontend tests, TypeScript, Biome, Vite and the Tauri build passed. Unlike the
first hub, this one was looked at in a browser preview of the component at 1100x720 and 640x640:
layout, labels and the scaled-down square window were checked by eye, and with motion on the
figure's feet and the tether's end were measured at the same point at four moments of the walk.
Two stylesheet guards were added because component tests do not apply CSS: the hub must stay
hideable, and every animation must sit behind the motion switch. Installed as desktop
`76e4a70e2191465bf7d7887d27691e95d8da4bbc553c99ce9c41735ba8d79652`; backend and schema unchanged.
Not verified: the scene inside the installed, unlocked app, and the walking-frame and facing
changes, which were not inspected frame by frame.

### Private chamber sprites (2026-10-05)

The owner can replace the built-in figures with their own images without publishing them. Files
named `job-os` or `oracle` with a `.png`, `.gif` or `.webp` extension, placed in
`apps/desktop/src/chamber/private/`, are picked up at build time and bundled into the executable
built on this PC. The folder is ignored by Git (by the general `private/` rule and an explicit
one), so nothing in it reaches the public repository. With no file present the built-in figures
are used. Instructions for the owner are in `apps/desktop/src/chamber/PRIVATE_SPRITES.md`.

Images are resolved by the bundler, not read at runtime: no native command, file access, asset
protocol or content-policy change was added. Vite's inlining of small images is switched off,
because the production policy allows images only as files from the app and would block an
inlined one. A new or changed image needs a rebuild and reinstall to appear.

Verification: 116 frontend tests pass, including name and format selection and a guard that the
folder stays ignored. A probe build with temporary PNG, GIF and WebP files emitted each as a
separate bundled file with no inlined image, and Git reported the folder as ignored; the probe
files were removed. Not verified: how a real owner-supplied sprite looks in the scene. This
change is committed but not installed, since without private files the app looks the same as the
installed desktop `76e4a70e...`.

### Chamber camera (2026-10-05)

The owner can move around the chamber. The mouse wheel zooms about the pointer between 0.6x and
3x. Holding the right mouse button drags the space; the left button is untouched, so figures are
still pressed normally, and the browser's context menu is suppressed inside the space. Header
buttons **−**, **+** and **Reset view** do the same from the keyboard. Dragging is limited so the
scene cannot be lost off screen. The view is not saved; it starts centred each time the hub is
shown after unlocking. The space is clipped rather than scrolled.

Verification: zoom, right-drag, limits, reset and left-button behaviour are covered by tests, and
a browser preview confirmed wheel zoom about the pointer and right-drag at about 2x with sharp
pixels. Not verified in the installed, unlocked window.

### Enter submits the rotation sequence (2026-10-05)

At the owner's request, pressing Enter after the turns are entered does what the **Unseal** button
does (and **Record sequence** / **Save rotation key** during enrollment). It works with keyboard
focus on the dial, which is where it is after dragging a turn, or with nothing focused. Enter only
submits a sequence the button would accept: 4 to 8 alternating turns, not while a request is
pending, and not from another control. While a keyboard turn is in progress Enter still finishes
that turn first, as before; Space never submits. The native check, the retry delay and the
password recovery form are unchanged; that form already submitted on Enter.

Verification: 125 frontend tests pass, five of them new, covering Enter on the dial and with
nothing focused, an incomplete sequence, the eighth turn, a disabled dial and Enter on another
button. Installed as desktop `4855d897478de4662c9b42a108a3a19d01a9a324a9711cd52b865ea7ab6ff476`. Not
verified in the real seal window, where the owner enters their own sequence.

### Figures on the agentless slots (2026-10-05)

At the owner's request the three unassigned pads now carry figures: a dark grey cat asleep on a cat
stand on slot 02, a hovering fighter in a glow on slot 03, and a cloaked watcher on slot 04. They
are scenery. Each slot is still labelled **UNASSIGNED — Figure only / no agent yet**, the figures
are not buttons, cannot be focused and have no tether to the core, and the footer reads "1 MODULE /
3 SLOTS WITHOUT AN AGENT". A figure becomes pressable only when an agent is built for its slot.
With motion on, the hovering figure bobs; that is decoration, not activity.

The owner asked for slots 03 and 04 to be two named characters from a television series and a
comic. As with the first figures, the built-in drawings are original designs for those roles and
not likenesses, because the repository is public. The private sprite folder now also accepts
`slot-2`, `slot-3` and `slot-4` images, so the owner can show their own artwork locally.

Verification: 127 frontend tests pass, including that the figures are decorative, unpressable and
untethered. The scene was viewed in a component preview at 1100x720; the first pass was too small
and too dark to read, so the figures were enlarged and lightened and viewed again. Installed as
desktop `c5d526506a1c5377953bcab8dc6cd923241e0a6ab5e374a48e2fdfc3da1e4b92`. Not verified in the
installed, unlocked window.

### Cat tower and local private figures (2026-10-05)

The built-in cat on slot 02 was redrawn at the owner's request: curled asleep, with ears, closed
eyes, stripes and a wrapped tail, on a tower three boxes high with ledges and a base.

Separately, the owner asked for their own figures on slots 03 and 04. Two small images were drawn
for them and placed in the Git-ignored `apps/desktop/src/chamber/private/` folder on this PC as
`slot-3.png` and `slot-4.png`. They are not part of this repository and are not described further
here; a fresh clone shows the built-in figures. This PC's installed desktop is therefore built
from the repository plus those two local files, so its hash is specific to this machine.

Verification: 128 frontend tests pass; one test was changed so it accepts either a built-in figure
or a locally supplied image, since it must pass with and without private files. The scene was
viewed in a component preview with the private images present. Git reports the private folder as
ignored. Installed as desktop `b85d5d0b2c222c315e0ca5ee2d8bc994d76d63f5a22efa6e29a6a6a720c72704`.
Not verified in the installed, unlocked window.

### Roaming figure and cat tree (2026-10-05)

A fifth figure now roams the space under the platform instead of standing on it. It lives in the
background layer, outside the camera, so it is not zoomed or dragged with the platform and passes
behind it. With motion on it flies a 48-second circuit around the platform (along the top, down
the right, back along the bottom, up the left), turning to face its direction and bobbing; with
motion off it rests at the lower left. It carries the tag **05 / UNASSIGNED — Figure only / no
agent yet**, is not pressable or focusable, and the footer reads "1 MODULE / 4 FIGURES WITHOUT AN
AGENT". The built-in drawing is an original winged glider; a private `slot-5` image replaces it.
On this PC the owner asked for their own figure there, which is in the Git-ignored private folder.

The owner has said that agents should eventually move over the whole interface rather than being
confined to the platform. This figure is the first element placed that way. Nothing else has been
moved, and a real agent's figure would also need to stay easy to press while it moves.

The built-in cat on slot 02 was redrawn again from the owner's reference photos: a slim dark
brown-black cat curled on the top perch of a grey cat tree with a cubby box and round opening, a
side platform, a hammock shelf, sisal posts and a base.

Verification: 129 frontend tests pass, including that the roaming figure sits in the background
layer outside the scene, is labelled and unpressable, and animates only behind the motion switch.
In a component preview the cat tree and the figure at two points of its circuit were viewed; on
the lower stretch the figure is hidden behind the platform, by design, with only its tag showing
below the platform's edge. Installed as desktop
`49bbe82657d560271d9e7b122d639c9a862417cb3ee8e16d169a47fdea90e596`, a build specific to this PC
because it bundles three Git-ignored local images. Not verified in the unlocked window.

### Larger platform, a page per figure, lines to the orb (2026-10-05)

This supersedes the "agentless slots" and "roaming figure" notes above where they say figures
cannot be pressed.

- The platform grew from a 10 by 10 court to 13 by 13 with wider wings, about 1.7 times the floor.
- All five figures are buttons and each opens its own page: **01 / JOB.OS** opens the job console
  as before; **02 / PERCH**, **03 / SUMMIT**, **04 / WATCH** and **05 / DEEP** open four rooms.
- The rooms deliberately look nothing alike (amber rings, a tilted yellow headline over peaks, a
  moonlit skyline, violet water) but share one small component and differ only in their
  stylesheet block. Each says plainly: "No agent lives here yet. This page does nothing: it stores
  nothing, reads none of your records and contacts nothing." A room holds no state, has no input
  and makes no request, so opening one cannot touch the backend, the database or the network.
- A dotted line runs from the orb to every figure's feet, including the one that roams the whole
  space. The lines are decoration, not a data link: the core is still labelled dormant.
- Figure tags and the footer ("5 FIGURES / 1 WITH A FUNCTION") say which figure has a function.

Structure, for whoever changes it next:

| File | Responsibility |
| --- | --- |
| `chamber/agents.ts` | The one list of figures: slot, name, drawing, private file name, position, movement, room text. Scene geometry lives here too |
| `Chamber.tsx` | Composes the hub and switches between hub, console and rooms |
| `chamber/ChamberScene.tsx` | The static drawing: court, pads, hourglasses, core |
| `chamber/camera.ts`, `chamber/motion.ts` | Zoom and drag; the motion switch |
| `chamber/useLeash.ts` | Draws the lines by reading where the orb and each figure are on the page |
| `chamber/AgentRoom.tsx`, `styles/rooms.css` | The four rooms |
| `ShellHeader.tsx` | The header bar shared by the hub, the rooms and the job console |

Adding a figure is one entry in `agents.ts`, plus a stylesheet block if it has a room. The earlier
keyframe trick that kept one tether in step with one walker was removed: lines now follow any
figure, the camera and window resizing by measurement. They redraw every frame only while motion
is on, and otherwise only when the camera or window changes.

No native command, backend operation, schema, dependency or content-policy change was made.

Verification: 133 frontend tests pass. They cover each room's honest wording, that a room has no
inputs and triggers no native call, focus returning to the figure that was opened, one line per
figure, figures placed inside the drawing with the roamer outside the camera, the camera, the
motion switch and the stylesheet guards. In a component preview the larger platform, all five
lines and each of the four rooms were viewed, and with motion on every line's end was measured
exactly at its figure's feet at two moments while two figures moved. A headline that wrapped
mid-word in one room was found there and fixed. Installed as desktop
`4ae455ab11550a054e274871fbb9c8ff5a7254cc49fadf88596933d40874fd66` (specific to this PC because it
bundles Git-ignored private images). Not verified in the installed, unlocked window.

### The swimmer under the floor (2026-10-05)

At the owner's request the fifth figure no longer flies around the platform. It is drawn from
above and swims a wide loop beneath the whole space, like a shadow under the floor.

- The platform floor is now slightly see-through, so the stars, the grid and the swimmer show
  faintly beneath it while the figures standing on it stay solid.
- The loop is one closed CSS motion path (an ellipse in the space's own box). The figure travels
  it clockwise in 80 seconds and turns one full circle per lap so its head leads, with a slow
  sway. It is larger than the other figures and partly transparent. With motion off it rests at a
  fixed point on the loop, already facing along it.
- Its line to the orb is held at its middle rather than its feet, since it is seen from above.
- It is still pressable and opens THE DEEP. Its tag sits under the floor with it and is faint
  there; the room it opens states that it has no function.
- The built-in drawing is an original ray seen from above. On this PC the owner's own top-down
  figure is in the Git-ignored private folder as `slot-5`.

The heading is a linear turn while the true direction along an ellipse is not quite linear, so the
head can be a few degrees off the path between the four compass points. That is a deliberate
simplification over driving the figure from script.

Verification: 133 frontend tests pass, with a guard that the swimmer uses a closed motion path and
turns from 180 to 540 degrees. In a component preview the path was measured at five points (right,
bottom, left and top of the loop in clockwise order), and the figure was viewed at two points with
its head leading and its line attached. Installed as desktop
`aad0bae068b79d3f381a88dadb4d09f9643d30098f877f478709895b5a34b893`, specific to this PC. Not verified
in the unlocked window.

### Figures that do something, and a pressable core (2026-10-05)

Each figure now has one small act of its own, chosen by an `act` field in `chamber/agents.ts`.
All of it is decoration and runs only while the Motion switch is on.

| Slot | Act | What is seen |
| --- | --- | --- |
| 01 / JOB.OS | `route` | Walks straight lines round the whole platform. At three corners it stands still for seven seconds under a shower of falling stars, then walks on. A lap takes about two minutes |
| 02 / PERCH | `tree` | A one-minute routine: asleep on the top perch with drifting z's, a stretch, down into the cubby and out of sight, out to the hammock shelf, back up, asleep again |
| 03 / SUMMIT | `beam` | Hovers, and every nine seconds charges and fires a beam. Each shot picks a new direction in steps of 30 degrees and the figure turns to face it |
| 04 / WATCH | `boomerang` | Every eight seconds winds up and throws something that circles out and returns |
| 05 / DEEP | `swim` | Unchanged: swims beneath the floor |

The walker's route and the beam's aim depend on data and on chance, so they are set from
`chamber/choreography.ts` (the Web Animations API for the route, a custom property for the aim).
Everything else is stylesheet keyframes. `chamber/AgentFigure.tsx` draws a figure and only the
extra pieces its act needs. A figure still pauses under the pointer or keyboard focus so it can
be pressed.

The core in the middle is now a button. It opens no page. Pressing it shows or hides four lines
in the caption above it: **Master agent: Not built**, **Model connected: None**, **Figures with a
function: 1 of 5**, **Ask Oracle: Not possible yet**. It reads nothing and calls nothing. Ten
blank panes circle the core and dim as they pass behind it; they are empty because nothing is
running, and the caption still says DORMANT. The core figure sways slightly. The orb moved to the
top of the dome so a taller core figure fits beneath it.

The sand timers no longer jump back to full. The glass is drawn the same at both ends; when the
upper bulb is empty it turns half a circle and the sand runs again.

Private artwork: the cat is now two extra optional files (`slot-2-asleep`, `slot-2-awake`) and
`slot-2` is the tree alone; `.svg` is accepted and preferred. On this PC all figures, including
the core, were redrawn for the owner as vector images in the Git-ignored private folder. They are
not in this repository; a fresh clone shows the built-in pixel figures doing the same acts.

No native command, backend operation, schema or dependency changed.

Verification: 139 frontend tests pass, covering the core button and its wording, the blank panes,
which pieces each act gets, the route's keyframes (closed loop, stars only at the stops, a lap
measured in minutes), the beam re-aiming, and stylesheet guards for the timer turn and the motion
switch. In a component preview with the private images, single frames were viewed at chosen
points: the beam in two directions, the star shower at a stop, the thrown piece in flight, the
timers mid-turn, the open status lines, and the cat at seven points of its routine. The preview
pane was unreliable for close-ups, so the cat frames were small and the routine was not watched
running in real time. Installed as desktop `2b563ae11256fe02a5e3fb7a93e0caf85292daefc5ba45e6216b85b2ce18eb7a`, specific to this PC. Not verified in the
installed, unlocked window.

### Routines, pose strips, a floor with steps, a sixth figure (2026-10-05)

This supersedes the previous section where it describes the beam's random aim, the thrown piece,
the cat's keyframes, the continuously circling panes and the moving grid.

**How movement works now.** A figure may have a `routine` in `chamber/agents.ts`: a loop of
beats, each naming a pose and optionally where to go, how long, a jump height, a side to face, or
that its effect should run. `chamber/choreography.ts` turns a routine into one timeline (place,
facing, which pose shows, effect progress as `--cast`) and runs it with the Web Animations API
while Motion is on. Nothing about a routine is written by hand in the stylesheet.

**How figures are drawn.** A pose is a strip of frames shown through a window one frame wide
(`chamber/AgentFigure.tsx`). Looping poses are stepped by one stylesheet rule; poses that play
once (a stretch, a jump, a charge) are stepped across their beat by the choreography. Built-in
drawings and owner-supplied images go through the same component.

| Figure | Now |
| --- | --- |
| 01 / JOB.OS | Walks the platform with a looping walk pose; at three stops shows a cast pose under slanted star trails that end in a flare |
| 02 / PERCH | The cat sleeps, wakes, stretches, jumps ledge to ledge, goes into the cubby (only its eyes show), sits in the hammock, goes down to the base, jumps back up and settles |
| 03 / SUMMIT | Flies a circuit that leaves the platform on every side, easing in and out, hovers at some stops, and at two stops charges and then fires a beam straight ahead |
| 04 / WATCH | Stands on a bar across the top of the left sand timer. No throw |
| 05 / DEEP | Swims as before, with rings spreading round it |
| 06 / HORIZON | New: a black hole turning off the platform toward the upper right, with its own page |
| Core | Seated at a console as part of its own drawing. Types; now and then sweeps an arm, after which the blank panes go twice round it and stop. Still a button that only shows its state |

**The floor.** The background grid and its movement are gone. The court now stands two steps
above a dark floor that is lit around the platform. Its specks do not move; coloured streaks,
curved swishes and sparks cross it occasionally, each on its own cycle length.

**Private art.** File names changed: `name-pose` for a pose, `name-prop` for the cat tree, and
`@N` before the extension for a strip of N frames (see `PRIVATE_SPRITES.md`). On this PC all
figures were redrawn as pixel strips by scripts kept inside the Git-ignored private folder. A
fresh clone shows the older built-in drawings, each standing in for every pose, plus the built-in
black hole, which is worked out in code.

No native command, backend operation, schema or dependency changed.

Verification: 143 frontend tests pass. They cover the timeline maths on a synthetic routine
(pace by distance, jump peak, facing, one-shot spans), that every real routine closes into a
loop with exactly one pose showing at a time, which elements are animated and that they halt
under the pointer, one strip per pose, the core's routine, the still floor, and the stylesheet
guards. In a component preview, single moments were viewed: the beam, the star shower, the cat
mid-jump and in the cubby, the timers turning, the core mid-sweep, the steps and the black hole.
The owner was given the same preview and sent changes, which are included. Nothing was watched
running in real time by the coding session. Installed as desktop `9d121010213bfbb7def3a3659ec5e67dccf9ebec62c9c36c1b68bba3837f0601`,
specific to this PC. Not verified in the installed, unlocked window; in particular the bundled
strips there have not been seen.

### Nothing crosses anything: layout and routes (2026-10-05)

The owner reported figures passing through each other and through the sand timers. Rather than
time the routines against each other, each moving figure now has ground of its own, so they
cannot meet whatever their timing or wherever one is halted under the pointer.

- **01** is renamed **QUEST** (it still opens the job console) and **03** is renamed **ZENITH**.
  The owner left the second name open; ZENITH is a placeholder choice.
- The walker patrols the front of the court and its right side, out and back along one line.
- The flyer circles outside that: down between the cat tree and the core, along the open floor
  below the court, up the right-hand side and back across the top between the caption and the
  dome. Its legs join without stopping; it gathers speed on the first and sheds it on the last.
- The cat tree moved to the lower left wing and is drawn at its intended size. It had been
  shown at the image's own small size because a button shrinks to fit its contents; widths are
  now stated.
- The swimmer is inside the scene, under the court only, so it zooms with the camera and never
  reaches the black hole. Only one see-through layer now lies over it.
- The black hole moved further from the court; the right sand timer moved along its wing; the
  ring of panes is a little tighter.

A test builds a box for every place each routine takes its figure and checks that none meets the
dome, the ring of panes, the cat tree, the black hole, the watcher, either sand timer, or any box
of the other mover, and that the swimmer's loop stays inside the court. Boxes are as wide as a
figure is drawn and square, which fits the owner's art; the taller built-in walker could still
brush something in a fresh clone. Tags are not counted and can pass over things.

Verification: 144 frontend tests pass. The layout was viewed in a component preview at three
moments. Installed as desktop `c813bd8fe9d000f31d30f3ac429491acd12ddeceba2ca7ee92a83f04adf2f9ee`, specific
to this PC. Not watched in real time and not verified in the unlocked window.

### The swimmer as a shadow with a wake (2026-10-06)

The owner said the swimmer looked as if it were on top of the court. It was already drawn before
the floor, but the previous round had made the court more see-through and left the figure at full
brightness. The court is back to its earlier opacity, and the swimmer's drawing is dimmed, dulled
and slightly softened so it reads as a shadow beneath the floor. The rings that spread from its
middle, which the owner said looked like radar, are replaced by a wake: three soft arcs that bow
toward the head, fall back past the tail, widen and fade.

Verification: 144 frontend tests pass, including a guard that the swimmer stays dimmed and that
no rings remain. The computed filter, the three wake parts and the drawing order were read from
a running preview; a screenshot could not be taken, so this round was **not seen by eye**.
Installed as desktop `53a87baaf966f08a682470d395fb33c4e9c606f7e1649a8417dc22341265e7a3`. Not verified
in the unlocked window.

## Windows icon maintenance

The black-and-green icon master is `src-tauri/icons/oracle.png`; `oracle-emblem.png` preserves
the transparent emblem. Generate `icons/icon.ico` with the installed Tauri icon command when
changing the artwork. `build.rs` explicitly watches that ICO so Cargo refreshes the executable's
Windows resource as well as the title-bar icon. The frontend uses `public/oracle.png`.

On Windows, `src/windows_icon.rs` explicitly sets `ICON_BIG` from the executable's embedded icon
group (32512). The current Tauri/Tao window-icon path sets only `ICON_SMALL`; relying on it alone
can leave the taskbar using a stale shell fallback. The shared native icon is owned by Windows
for the process lifetime. A native test verifies the large-icon registration on a hidden window.
Reassess this workaround when upgrading Tauri/Tao. No renderer permission is added.

## Checks

From `apps/desktop`:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd audit
Set-Location src-tauri
cargo fmt --check
cargo test --locked
cargo clippy --locked --all-targets -- -D warnings
```

Run the Python checks from the root README after changing the backend. Frontend tests cover password setup, denied access, locking, error handling, connection status,
and stale replies. Rust tests cover credential persistence, restart locking, unique salts, password
validation, throttling, corrupt settings, health responses, and navigation restrictions. Python tests
cover health, configuration, host validation, CORS, and startup.
Commit `package-lock.json` and `Cargo.lock`; generated build output remains ignored.

## Security boundaries

- The window loads local assets only. A Rust navigation handler rejects other origins, popup
  windows are denied, and downloads are denied. Development navigation is allowed only in debug builds.
- The sole Tauri capability names the `main` window and explicitly permits six app commands:
  password status, setup, unlock, lock, a guarded health check, and guarded application operations.
  Commands are registered in the
  build manifest for capability enforcement. No general filesystem, shell, opener, or HTTP plugin
  is exposed to the renderer. New privileged commands must check native access state.
- A [Content Security Policy](https://v2.tauri.app/security/csp/) limits renderer connections to
  Tauri's internal IPC transport. Production has no remote scripts,
  wildcard sources, `unsafe-eval`, or `unsafe-inline`. Development permits inline scripts/styles
  for React refresh and Vite's local WebSocket. Those exceptions are not in the production policy.
- Camera, microphone, geolocation, and screen-capture access are denied by Permissions-Policy.
  Drag/drop is disabled; the UI does not read arbitrary files or render arbitrary HTML.
- Native health requests send no passwords or cookies, bypass proxy settings, reject redirects,
  cap responses at 1 KiB, and time out after three seconds. The fixed destination is not configurable
  through IPC. Locking discards in-flight results. Cancelling renderer checks discards replies; it
  does not interrupt the native request, which is bounded by its timeout.
  Failed requests expose a generic message rather than raw network errors. No background polling
  occurs; the displayed result is from the last check, not continuous service monitoring.
- The backend allows only the packaged Windows origin, plus the development origin when explicitly
  enabled. CORS controls browser response access; it does not authenticate clients or block every
  possible request. A forged Origin header from another process is not proof of identity.
- The endpoint remains public to local processes and reports liveness only. Its response does not
  prove the responding process is Oracle. Before adding HTTP personal data or actions, implement and
  test authentication, origin validation for writes, and lifecycle/port ownership together.

The display name is Oracle. Existing `JOB_OS_*` backend environment variables and the Python
distribution name remain unchanged so the earlier setup continues to work. The historical
`PROJECT_CONTEXT.md` is preserved.

## Local password

First launch asks you to create and confirm a 15-128 character password. Use a long, unique
passphrase and keep it in a password manager. Every new app process starts locked. The **Lock Oracle**
button also locks the current process. Minimizing or changing focus does not lock it automatically.
Each app instance has its own session; there is no remembered login or browser storage token.

Rust verifies the password through Tauri IPC. Passwords never enter the HTTP health request.
The only persisted credential is a randomly salted Argon2id v19 PHC hash at
`%LOCALAPPDATA%\local.oracle.desktop\password.phc`. Parameters are 19 MiB memory, two iterations,
one lane, and a 32-byte output, following the [OWASP password storage minimum](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
The implementation uses [RustCrypto Argon2](https://docs.rs/argon2/latest/argon2/).
Password hashing runs off the UI thread and credential operations are serialized. Failed attempts
have an increasing 2-30 second cooldown within the process. Restarting the process resets the cooldown;
the hash's cost is the protection against offline guessing. Rust password buffers are zeroized when
released; JavaScript/IPC temporary copies cannot be guaranteed to be wiped by the garbage collector.
Passwords and hashes are never logged or returned to the renderer.

Creation uses exclusive file creation and flushes the hash to disk before unlocking. An unreadable,
truncated, oversized, or unsupported hash file fails closed; Oracle does not overwrite it or silently
reset the password. If settings are damaged, restore them from a trusted local backup. There is no
email recovery, password-change UI, or recovery secret in this milestone.

Successful first password creation explicitly initializes a new application workspace. Existing
passwords never trigger automatic database recreation. Database identity and lifecycle checks are
documented in [application storage](APPLICATIONS.md#workspace-lifecycle-and-recovery). If initial
database creation fails after the password was stored, retain the password and reopen Oracle for
recovery; do not delete the hash or retry setup as if the workspace were new.

This is an **application access lock**, not disk encryption or an authenticated Python API. The only
backend endpoint remains public liveness. Future personal-data endpoints require their own protected
desktop/backend channel before implementation. Windows account isolation protects the settings folder;
someone able to modify your files, delete the hash, patch the executable, or run code as you can bypass
this local lock. A missing hash is treated as first-run setup only when no application database
exists. With an existing database, missing credentials fail closed. Do not delete the hash to
reset a workspace; restore the original hash from a private backup. On a replacement PC, initialize
a new password in an empty workspace before restoring a database backup. Never copy credentials
into the source repository. See [backup and restore](BACKUP.md).

## Dependency review (2026-09-24)

The npm installation audit reported no known vulnerabilities. An OSV query of all 446 registry
packages in `Cargo.lock` returned these upstream findings:

- `glib 0.18.5`: [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html),
  an unsound iterator implementation. `cargo tree --target x86_64-pc-windows-msvc -i glib`
  confirms it is not in this Windows build. Reassess before supporting Linux.
- `proc-macro-error 1.0.4`: [RUSTSEC-2024-0370](https://rustsec.org/advisories/RUSTSEC-2024-0370.html),
  an unmaintained dependency, also absent from the Windows dependency tree.
- The `unic-* 0.9.0` crates used by `urlpattern 0.3.0` through `tauri-utils 2.9.3` have
  unmaintained advisories: [0075](https://rustsec.org/advisories/RUSTSEC-2025-0075.html),
  [0080](https://rustsec.org/advisories/RUSTSEC-2025-0080.html),
  [0081](https://rustsec.org/advisories/RUSTSEC-2025-0081.html),
  [0098](https://rustsec.org/advisories/RUSTSEC-2025-0098.html), and
  [0100](https://rustsec.org/advisories/RUSTSEC-2025-0100.html). These are present in the Windows
  dependency tree. The advisories list no patched versions; replacing them requires an upstream
  dependency migration rather than a compatible patch-version update.

These findings are not silently suppressed or resolved by the app's CSP. Track Tauri dependency
updates and recheck before distribution or adding sensitive capabilities. The checks above are
a point-in-time advisory review, not a penetration test or a guarantee of security.

## Identity review

Open **03 / IDENTITY** after unlocking Oracle to review the extracted candidate draft. Select an
entry, compare the document/page excerpts, correct fields, and approve or reject it explicitly. Each
approval saves immediately. Pending requests disable review controls; conflicts preserve corrections
and require reloading the latest state before retrying. Approved entries remain owner assertions,
not verified credentials. See [PROFILE.md](PROFILE.md) for storage, recovery, and review limitations.

## Document version history

**02 / VAULT** now groups latest documents with earlier originals under **Version history**.
Search includes older filenames. Profile citations show their version and warn if a newer original
exists. New versions are imported through the explicit maintenance command in
[DOCUMENTS.md](DOCUMENTS.md#explicit-versions-step-6-schema-0007); an in-app import picker is not
implemented. Replacing a source never silently changes reviewed profile claims.

## WSL development boundary

The installed desktop now invokes Ubuntu workers through its explicit WSL adapter. Production
cutover completed on 2026-09-30; the live database is private to Linux, while the existing password
gate and hash remain on Windows. Windows Python remains available for legacy maintenance and tests
of the Windows transport, but it no longer owns the active records. Runtime configuration and
transition markers fail closed instead of falling back to stale Windows data.
See [WSL_DEVELOPMENT.md](WSL_DEVELOPMENT.md) for exact paths, validation, and recovery constraints.

## Circular launcher and rotation key (2026-09-30)

Oracle now starts as a 560-logical-pixel circular Windows window. Native window-region clipping
removes the corners from both drawing and mouse interaction. The existing green emblem is a dial;
the ORACLE label moves the window, and the small minus/cross controls minimize/close it. Successful
native authentication expands the same window into the normal decorated, resizable workspace.
Locking unmounts records immediately and returns to the circle. The Linux runtime is unchanged.

On first use, choose **Initialize rotation key**, enter the existing Oracle password, then choose
**Set rotation key**. Make 4–8 alternating clockwise/counterclockwise turns, releasing after each.
Each turn is a signed relative distance of 1–24 stops; 12 stops make a revolution. Starting position
and timing are not part of the key. Repeat the sequence to confirm it; Oracle then locks so the first
unlock also proves the saved key works. **Clear turns** restarts entry. With keyboard focus on the
dial, Left/Right move one stop and Space/Enter commits a turn. Cancelled drags are discarded.

The owner chooses the actual sequence privately in the application, never in chat or a fixture.
Enrollment can be postponed. **Password recovery** retains the existing password and opens the
workspace even if the rotation hash is damaged. This version creates a key once; changing an already
saved key is not yet exposed. Do not delete credentials to reset them.

The native layer checks bounds, alternating direction, confirmation, and authenticated enrollment;
it stores only a salted Argon2id hash in private Windows AppData `rotation.phc`. Password and dial
attempts share the existing session-local retry delay. Closing/reopening resets that delay. Short
or predictable sequences are weaker than long passwords; this is a local access gate, not database
encryption or protection against an attacker controlling the Windows account. Credentials stay out
of Git, Linux, and record backups. Missing password storage alongside WSL runtime markers fails
closed instead of allowing replacement-password setup.

Validation: 52 frontend tests and 24 native tests passed, along with TypeScript, Biome, Clippy and
the Windows production build. Two unchanged WSL integration probes were not rerun for this
desktop-only change. Frontend tests cover enrollment, recovery, rejected/pending unlock, keyboard and pointer
input, cancellation, and locking. Native tests cover hash persistence, throttling, enrollment
authorization, migration recovery, and actual Windows region clipping/scaling/removal on a synthetic
hidden window. The computer-use helper could not connect (`native pipe unavailable`), so visual
inspection of the live window and the complete mouse-to-native unlock transition remain unverified.
