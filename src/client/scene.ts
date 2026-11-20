import * as THREE from 'three';
import { ISLAND_RADIUS } from '../core/config.js';
import type { GameSimulation } from '../core/simulation.js';

interface LanternVisual {
  group: THREE.Group;
  core: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  ring: THREE.Mesh;
}

interface ShadeVisual {
  group: THREE.Group;
  bodyMat: THREE.MeshStandardMaterial;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
}

interface PulseWave {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  maxRadius: number;
}

export class LanternIslandScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private moonLight: THREE.DirectionalLight;
  private fog: THREE.FogExp2;

  private playerGroup: THREE.Group;
  private playerLanternLight: THREE.PointLight;
  private orbitOrbs: THREE.Mesh[] = [];
  private lanternVisuals = new Map<string, LanternVisual>();
  private moteMeshes = new Map<string, THREE.Mesh>();
  private shadeVisuals = new Map<string, ShadeVisual>();
  private pulseWaves: PulseWave[] = [];
  private stars: THREE.Points;
  private visualTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0818);
    this.fog = new THREE.FogExp2(0x130b22, 0.024);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      250
    );

    // Base lights (brighten dynamically as lanterns are lit)
    this.ambientLight = new THREE.AmbientLight(0x3a2e5c, 0.55);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x4b3f72, 0x1a1326, 0.5);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0xa5b4fc, 0.55);
    this.moonLight.position.set(18, 36, -22);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 5;
    this.moonLight.shadow.camera.far = 100;
    const d = 38;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.scene.add(this.moonLight);

    this.stars = this.buildSkyAndSeaOfClouds();
    this.buildIsland();
    const { group, lanternLight } = this.buildPlayerMay();
    this.playerGroup = group;
    this.playerLanternLight = lanternLight;
    this.scene.add(this.playerGroup);

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private buildSkyAndSeaOfClouds(): THREE.Points {
    // Sea of clouds below the island
    const cloudGeo = new THREE.PlaneGeometry(300, 300);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x1a132d,
      roughness: 1,
      metalness: 0,
    });
    const cloudPlane = new THREE.Mesh(cloudGeo, cloudMat);
    cloudPlane.rotation.x = -Math.PI / 2;
    cloudPlane.position.y = -3.2;
    this.scene.add(cloudPlane);

    // Starfield
    const starCount = 450;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = ((i * 137.5) % 360) * (Math.PI / 180);
      const phi = Math.acos(0.15 + ((i * 0.618033) % 0.85));
      const r = 110;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffe9b3,
      size: 0.75,
      transparent: true,
      opacity: 0.65,
    });
    const stars = new THREE.Points(geo, mat);
    this.scene.add(stars);
    return stars;
  }

  private buildIsland(): void {
    // Main circular island ground (top surface at Y = 0)
    const islandGeo = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 2, 3.5, 48);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x243330,
      roughness: 0.92,
      metalness: 0.05,
    });
    const island = new THREE.Mesh(islandGeo, islandMat);
    island.position.y = -1.75;
    island.receiveShadow = true;
    this.scene.add(island);

    // Warm stone ring path connecting the 5 lanterns at radius 20
    const pathGeo = new THREE.RingGeometry(18.5, 21.5, 48);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x3b364a,
      roughness: 0.95,
    });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.y = 0.02;
    path.receiveShadow = true;
    this.scene.add(path);

    // Center stone plaza at (0, 0, 0)
    const plazaGeo = new THREE.CylinderGeometry(3.8, 4.1, 0.12, 24);
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0x453e56, roughness: 0.9 });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.y = -0.02;
    plaza.receiveShadow = true;
    this.scene.add(plaza);

    // Wooden dock (Đảo Bến landmark) extending at -Z edge
    const dockMat = new THREE.MeshStandardMaterial({ color: 0x5c3e2b, roughness: 0.85 });
    const dockDeck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 8.5), dockMat);
    dockDeck.position.set(0, 0.05, -(ISLAND_RADIUS + 2.5));
    dockDeck.receiveShadow = true;
    this.scene.add(dockDeck);

    // Small decorative wooden boat moored beside the dock
    const boatHull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 3.6), dockMat);
    boatHull.position.set(3.6, -0.35, -(ISLAND_RADIUS + 4.5));
    boatHull.rotation.y = 0.35;
    this.scene.add(boatHull);

    // Decorative low boundary posts around island edge
    const postGeo = new THREE.CylinderGeometry(0.14, 0.18, 1.0, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4e3932, roughness: 0.9 });
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(Math.cos(a) * (ISLAND_RADIUS - 0.8), 0.5, Math.sin(a) * (ISLAND_RADIUS - 0.8));
      post.castShadow = true;
      this.scene.add(post);
    }
  }

  private buildPlayerMay(): { group: THREE.Group; lanternLight: THREE.PointLight } {
    const group = new THREE.Group();

    // Cloak body (warm cream & indigo fairy-tale tunic)
    const cloakGeo = new THREE.ConeGeometry(0.45, 1.15, 12);
    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0xf4e4c8,
      roughness: 0.75,
    });
    const cloak = new THREE.Mesh(cloakGeo, cloakMat);
    cloak.position.y = 0.6;
    cloak.castShadow = true;
    group.add(cloak);

    // Scarf
    const scarfGeo = new THREE.TorusGeometry(0.24, 0.07, 8, 16);
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.6 });
    const scarf = new THREE.Mesh(scarfGeo, scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.08;
    group.add(scarf);

    // Head
    const headGeo = new THREE.SphereGeometry(0.24, 14, 14);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.28;
    head.castShadow = true;
    group.add(head);

    // Nón lá (Vietnamese conical hat)
    const hatGeo = new THREE.ConeGeometry(0.68, 0.42, 20);
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xe8c77b,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 1.56;
    hat.castShadow = true;
    group.add(hat);

    // Tiny glowing lantern hanging from the front brim of the nón lá
    const stringMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6),
      new THREE.MeshBasicMaterial({ color: 0x5c3e2b })
    );
    stringMesh.position.set(0, 1.28, 0.52);
    group.add(stringMesh);

    const tinyLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffc247,
        emissive: 0xff9f1c,
        emissiveIntensity: 2.2,
      })
    );
    tinyLantern.position.set(0, 1.12, 0.52);
    group.add(tinyLantern);

    const lanternLight = new THREE.PointLight(0xffb347, 2.2, 11, 1.6);
    lanternLight.position.set(0, 1.35, 0.55);
    group.add(lanternLight);

    // Orbiting carried firefly orbs (up to 5)
    const orbGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const orbMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    for (let i = 0; i < 5; i++) {
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.visible = false;
      group.add(orb);
      this.orbitOrbs.push(orb);
    }

    return { group, lanternLight };
  }

  private createLanternVisual(id: string, pos: [number, number, number]): LanternVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);

    // Stone pedestal
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x4b4459, roughness: 0.9 })
    );
    base.position.y = 0.3;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Wooden pillar
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 2.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c3e2b, roughness: 0.85 })
    );
    pillar.position.y = 1.9;
    pillar.castShadow = true;
    group.add(pillar);

    // Lantern glowing core
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x4d3f59,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.05,
      roughness: 0.4,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 1), coreMat);
    core.position.y = 3.5;
    group.add(core);

    // Lantern roof cap
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.05, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x3b2c35, roughness: 0.8 })
    );
    roof.position.y = 4.25;
    roof.castShadow = true;
    group.add(roof);

    // Warm golden light (off until lit)
    const light = new THREE.PointLight(0xffa93a, 0, 18, 1.5);
    light.position.y = 3.5;
    group.add(light);

    // Subtle safe-radius ring on ground when lit
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.85, 5.05, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffb84d,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    this.scene.add(group);
    const visual = { group, core, coreMat, light, ring };
    this.lanternVisuals.set(id, visual);
    return visual;
  }

  private createShadeVisual(id: string): ShadeVisual {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x180b29,
      emissive: 0x3b0f66,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    });

    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.68, 1), bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    group.add(body);

    // Wispy tail cone below
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 8), bodyMat);
    tail.rotation.x = Math.PI;
    tail.position.y = 0.45;
    group.add(tail);

    // Glowing violet eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd946ef });
    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
    leftEye.position.set(-0.22, 1.1, 0.56);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
    rightEye.position.set(0.22, 1.1, 0.56);
    group.add(rightEye);

    this.scene.add(group);
    const vis = { group, bodyMat, leftEye, rightEye };
    this.shadeVisuals.set(id, vis);
    return vis;
  }

  spawnPulseEffect(pos: [number, number, number], maxRadius: number): void {
    const ringGeo = new THREE.RingGeometry(0.7, 1.0, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffcc55,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos[0], 0.15, pos[2]);
    this.scene.add(mesh);
    this.pulseWaves.push({ mesh, age: 0, maxAge: 0.55, maxRadius });
  }

  sync(sim: GameSimulation, camYawDeg: number, dt: number): void {
    this.visualTime += dt;

    // 1. Update player position, facing, invuln blink, orbiting fireflies
    this.playerGroup.position.set(
      sim.player.pos[0],
      sim.player.pos[1],
      sim.player.pos[2]
    );
    this.playerGroup.rotation.y = sim.player.facingYaw;
    const blinkHidden =
      sim.player.invulnTimer > 0 && Math.floor(this.visualTime * 16) % 2 === 0;
    this.playerGroup.visible = !blinkHidden;
    this.playerLanternLight.intensity = 2.0 + Math.sin(this.visualTime * 5) * 0.25;

    for (let i = 0; i < this.orbitOrbs.length; i++) {
      const orb = this.orbitOrbs[i];
      if (i < sim.player.carried) {
        orb.visible = true;
        const angle = this.visualTime * 2.4 + (i * Math.PI * 2) / Math.max(1, sim.player.carried);
        orb.position.set(
          Math.cos(angle) * 0.85,
          1.25 + Math.sin(this.visualTime * 3.5 + i) * 0.15,
          Math.sin(angle) * 0.85
        );
      } else {
        orb.visible = false;
      }
    }

    // 2. Sync lanterns & compute island lighting ratio
    let litCount = 0;
    for (const l of sim.lanterns) {
      let vis = this.lanternVisuals.get(l.id);
      if (!vis) {
        vis = this.createLanternVisual(l.id, l.pos);
      }
      vis.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      if (l.lit) {
        litCount++;
        vis.coreMat.color.setHex(0xffd166);
        vis.coreMat.emissiveIntensity = 2.4 + Math.sin(this.visualTime * 4 + l.pos[0]) * 0.25;
        vis.light.intensity = 5.5;
        (vis.ring.material as THREE.MeshBasicMaterial).opacity = 0.25;
      } else {
        const progress = l.deposited / Math.max(1, sim.tuning.lantern_cost);
        vis.coreMat.color.setHex(progress > 0 ? 0x996e46 : 0x4d3f59);
        vis.coreMat.emissiveIntensity = 0.08 + progress * 0.9;
        vis.light.intensity = progress * 1.4;
        (vis.ring.material as THREE.MeshBasicMaterial).opacity = 0.0;
      }
      vis.core.rotation.y = this.visualTime * (l.lit ? 1.2 : 0.3);
    }

    // Island brightens warmly as lanterns are lit
    const ratio = sim.lanterns.length > 0 ? litCount / sim.lanterns.length : 0;
    this.ambientLight.intensity = 0.55 + ratio * 0.75;
    this.ambientLight.color.setRGB(
      0.23 + ratio * 0.35,
      0.18 + ratio * 0.28,
      0.36 - ratio * 0.08
    );
    this.fog.density = 0.024 - ratio * 0.013;
    this.fog.color.setRGB(
      0.075 + ratio * 0.09,
      0.043 + ratio * 0.06,
      0.133 + ratio * 0.02
    );
    (this.stars.material as THREE.PointsMaterial).opacity = 0.55 + ratio * 0.45;

    // 3. Sync motes
    const activeMoteIds = new Set(sim.motes.map((m) => m.id));
    for (const [id, mesh] of this.moteMeshes) {
      if (!activeMoteIds.has(id)) {
        this.scene.remove(mesh);
        this.moteMeshes.delete(id);
      }
    }
    for (const m of sim.motes) {
      let mesh = this.moteMeshes.get(m.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0xffd166 })
        );
        this.scene.add(mesh);
        this.moteMeshes.set(m.id, mesh);
      }
      const bob = 0.75 + Math.sin(this.visualTime * 3.2 + m.pos[0] + m.pos[2]) * 0.22;
      mesh.position.set(m.pos[0], bob, m.pos[2]);
    }

    // 4. Sync shades
    const activeShadeIds = new Set(sim.shades.map((s) => s.id));
    for (const [id, vis] of this.shadeVisuals) {
      if (!activeShadeIds.has(id)) {
        this.scene.remove(vis.group);
        this.shadeVisuals.delete(id);
      }
    }
    for (const s of sim.shades) {
      let vis = this.shadeVisuals.get(s.id);
      if (!vis) {
        vis = this.createShadeVisual(s.id);
      }
      const hover = Math.sin(this.visualTime * 4 + s.pos[0]) * 0.15;
      vis.group.position.set(s.pos[0], hover, s.pos[2]);

      if (s.state === 'stunned') {
        vis.bodyMat.emissive.setHex(0xffe082);
        vis.bodyMat.emissiveIntensity = 1.2;
        vis.group.rotation.y += dt * 8;
        vis.group.scale.setScalar(0.82);
      } else {
        vis.bodyMat.emissive.setHex(0x3b0f66);
        vis.bodyMat.emissiveIntensity = 0.6;
        const dx = sim.player.pos[0] - s.pos[0];
        const dz = sim.player.pos[2] - s.pos[2];
        vis.group.rotation.y = Math.atan2(dx, dz);
        vis.group.scale.setScalar(1.0);
      }
    }

    // 5. Update pulse wave animations
    for (let i = this.pulseWaves.length - 1; i >= 0; i--) {
      const pw = this.pulseWaves[i];
      pw.age += dt;
      if (pw.age >= pw.maxAge) {
        this.scene.remove(pw.mesh);
        pw.mesh.geometry.dispose();
        (pw.mesh.material as THREE.Material).dispose();
        this.pulseWaves.splice(i, 1);
      } else {
        const t = pw.age / pw.maxAge;
        const scale = 0.5 + t * pw.maxRadius;
        pw.mesh.scale.setScalar(scale);
        (pw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
      }
    }

    // 6. Third-person camera following Mây with camYawDeg
    const theta = (camYawDeg * Math.PI) / 180;
    const camDist = 11.5;
    const camHeight = 6.2;
    const camX = sim.player.pos[0] - Math.sin(theta) * camDist;
    const camZ = sim.player.pos[2] - Math.cos(theta) * camDist;
    this.camera.position.lerp(
      new THREE.Vector3(camX, sim.player.pos[1] + camHeight, camZ),
      Math.min(1, dt * 10)
    );
    this.camera.lookAt(
      sim.player.pos[0],
      sim.player.pos[1] + 1.4,
      sim.player.pos[2]
    );

    this.renderer.render(this.scene, this.camera);
  }
}
