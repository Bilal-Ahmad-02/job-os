# Private chamber sprites

Image files placed in the `private` folder beside this note replace the built-in figures in the
chamber. Create the folder if it is missing: `apps/desktop/src/chamber/private`. Git ignores
everything inside it, so your images never reach the public repository. They are bundled into the
desktop executable when you build it on this PC.

| File name | Replaces |
| --- | --- |
| `job-os` | 01 / JOB.OS, the figure that walks the platform and opens the job-search console |
| `slot-2` | 02 / PERCH: the cat tree, without the cat |
| `slot-2-asleep` | The cat curled up asleep |
| `slot-2-awake` | The cat on its feet, facing left |
| `slot-3` | 03 / SUMMIT, the hovering figure that fires a beam |
| `slot-4` | 04 / WATCH, the figure that throws something that comes back |
| `slot-5` | 05 / DEEP, which swims beneath the whole space. Draw it from above with its head at the top |
| `oracle` | The seated figure at the console in the middle |

Add an extension: `.svg`, `.png`, `.gif` or `.webp`, for example `job-os.svg`. If more than one
format exists for a name, that is the order of choice. Vector art (`.svg`) stays sharp at any zoom.

Drawing notes:

- Use a transparent background. Pixel art stays sharp; it is scaled without smoothing.
- The walking figure is shown about 2 wide by 3 tall and stands on its bottom edge. The seated
  figure and the slot figures are about 6 wide by 7 tall. Other proportions are fitted inside the
  same space.
- Every figure opens its own page. Only 01 / JOB.OS has a function so far.
- An animated GIF or WebP keeps playing even when the hub's Motion switch is off.
- Draw the walking figure facing left; the app mirrors it for the walk back.

A new image appears only after rebuilding and reinstalling the desktop. With Oracle closed, in
PowerShell from `apps/desktop`:

```powershell
npm.cmd run desktop:build
powershell.exe -NoProfile -File ..\..\scripts\install_desktop.ps1
```

Remove a file and rebuild to return to the built-in figure. Only use artwork you are allowed to use.
