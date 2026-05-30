# Assignment 5 – Hunter Pettus
## Three.js ISS Space Scene

Claude Code Used for figuring out black hole mechanisim as well as explaining the fitting for the rubric. 

Textbook/provided three.js resources used to figure out camera controls. 

A first-person explorable 3D space scene built with Three.js featuring the International Space Station in low Earth orbit.

---

## Light Sources (Rubric)

The scene uses **5 different light types**, exceeding the requirement of 3:

| # | Type | Purpose |
|---|------|---------|
| 1 | `AmbientLight` | Dim dark-blue fill light simulating the faint glow of deep space |
| 2 | `DirectionalLight` | The Sun — harsh parallel light casting shadows across the ISS and Earth |
| 3 | `HemisphereLight` | Subtle sky/ground gradient adding depth to the scene |
| 4 | `PointLight` | Earth glow, Sun corona, and 6 colored satellite beacon lights (red, blue, green, yellow, purple) that blink independently |
| 5 | `SpotLight` | Two spotlights: one illuminating the ISS from above, one mounted on a satellite and aimed at the ISS |

---

## Wow Factor

Two interactive destruction events, activated in sequence:

1. **💥 DETONATE EARTH** — Press `E` or click the button. Earth shatters into 80 fragments that fly outward with a shockwave flash.
2. **🌀 SPAWN BLACK HOLE** — Unlocked after detonating Earth. Press `B` or click the button. A black hole with a spinning accretion disk spawns in the distance. Gravity ramps up over ~8 seconds and pulls every object in the scene — Earth fragments, the Moon, the ISS, all 9 satellites, asteroids, and debris — spiraling them in. The black hole grows as it consumes objects.

---

## Controls

- **Left-drag** — Orbit camera
- **Right-drag** — Pan camera
- **Scroll** — Zoom in/out
- **E** — Detonate Earth
- **B** — Spawn Black Hole (after Earth is detonated)
