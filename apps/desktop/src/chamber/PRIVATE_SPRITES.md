# Private chamber sprites

Image files placed in the `private` folder beside this note replace the built-in figures in the
chamber. Create the folder if it is missing: `apps/desktop/src/chamber/private`. Git ignores
everything inside it, so your images never reach the public repository. They are bundled into the
desktop executable when you build it on this PC. Only image files directly in the folder are
used; sub-folders are left alone, so they are a safe place for sources and old versions.

## File names

`figure.png` is the figure's main drawing. `figure-pose.png` is one pose. `figure-prop.png` is
the thing a figure lives on. To animate a drawing, put its frames side by side in one image, all
the same size, and write the number of frames before the extension: `figure-pose@8.png`.

Accepted formats are `.svg`, `.png`, `.gif` and `.webp`, chosen in that order if a name exists
in more than one. A pose with no image of its own uses the figure's main drawing.

| Figure | Name | Poses its routine uses |
| --- | --- | --- |
| 01 / QUEST, walks the platform | `job-os` | `walk`, `cast` |
| 02 / PERCH, the cat | `slot-2` | `sleep`, `wake`, `stretch`, `hop`, `sit`, `walk`, `hide`, `settle`; the tree is `slot-2-prop` |
| 03 / KI, flies | `slot-3` | `idle`, `fly`, `charge`, `fire` |
| 04 / WATCH, on the sand timer | `slot-4` | none: one looping strip |
| 05 / DEEP, swims under the floor | `slot-5` | none: one looping strip, drawn from above with the head at the top |
| 06 / HORIZON, the black hole | `slot-6` | none: one looping strip |
| 07 / PROWL, by the lake | `slot-7` | `lurk`, `walk`, `wade`, `swim`, `rise`, `shake` |
| 08 / THIRST | `slot-8` | none: one looping strip |
| 09 / COURT | `slot-9` | none: one looping strip |
| 10 / CLOUD, drifts in the sky | `slot-10` | none: one looping strip |
| 11 / GAMBIT | `slot-11` | none: one looping strip |
| 12 / THROTTLE, the motorcycle | `slot-12` | `rev`, `ride`, `gone` (an empty frame while it is put back) |
| 13 / DRIFT | `slot-13` | none: one looping strip |
| 14 / POND | `slot-14` | none: one looping strip |
| 15 / GROTTO | `slot-15` | none: one looping strip |
| 16 / PILGRIM | `slot-16` | none: one looping strip |
| 17 / WRATH | `slot-17` | none: one looping strip |
| 18 / STARE | `slot-18` | none: one looping strip |
| The core at its console | `oracle` | `type`, `swipe` |

## Drawing notes

- Use a transparent background. Images are scaled without smoothing, so pixel art stays sharp.
- Draw figures facing left; the app mirrors them when they head right.
- Every pose of one figure should use the same frame size, with the feet in the same place.
- A looping pose repeats its frames; `wake`, `stretch`, `hop`, `settle`, `charge` and `swipe`
  play through once each time they are used.
- The cat's frames are placed by its paws on the tree, and its tree drawing should keep the
  perch, ledge, shelf, cubby door, hammock and base where the built-in one has them.
- An animated GIF or WebP keeps playing even when the hub's Motion switch is off.
- Every figure opens its own page except the core. Only 01 / QUEST has a function so far.

A new image appears only after rebuilding and reinstalling the desktop. With Oracle closed, in
PowerShell from `apps/desktop`:

```powershell
npm.cmd run desktop:build
powershell.exe -NoProfile -File ..\..\scripts\install_desktop.ps1
```

Remove a file and rebuild to return to the built-in figure. Only use artwork you are allowed to use.
