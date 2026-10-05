# Private chamber sprites

Image files placed in the `private` folder beside this note replace the built-in figures in the
chamber. Create the folder if it is missing: `apps/desktop/src/chamber/private`. Git ignores
everything inside it, so your images never reach the public repository. They are bundled into the
desktop executable when you build it on this PC.

| File name | Replaces |
| --- | --- |
| `job-os.png` | The walking figure that opens the job-search console |
| `oracle.png` | The seated figure at the console in the middle |
| `slot-2.png` | The figure on slot 02 (built in: a sleeping cat on a stand) |
| `slot-3.png` | The figure on slot 03 (built in: a hovering fighter; it floats above the pad) |
| `slot-4.png` | The figure on slot 04 (built in: a cloaked watcher) |
| `slot-5.png` | The figure that roams the space under the platform (built in: a winged glider). Draw it facing right; it is mirrored for the flight back |

`.png`, `.gif` and `.webp` are accepted, for example `job-os.gif`. If more than one format exists
for a name, PNG wins, then GIF, then WebP.

Drawing notes:

- Use a transparent background. Pixel art stays sharp; it is scaled without smoothing.
- The walking figure is shown about 2 wide by 3 tall and stands on its bottom edge. The seated
  figure and the slot figures are about 6 wide by 7 tall. Other proportions are fitted inside the
  same space.
- Slot figures are scenery for slots that have no agent yet. They cannot be clicked until an
  agent is built for that slot.
- An animated GIF or WebP keeps playing even when the hub's Motion switch is off.
- Draw the walking figure facing left; the app mirrors it for the walk back.

A new image appears only after rebuilding and reinstalling the desktop. With Oracle closed, in
PowerShell from `apps/desktop`:

```powershell
npm.cmd run desktop:build
powershell.exe -NoProfile -File ..\..\scripts\install_desktop.ps1
```

Remove a file and rebuild to return to the built-in figure. Only use artwork you are allowed to use.
