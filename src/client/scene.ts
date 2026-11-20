import * as THREE from 'three';
import { PALETTE } from '../core/config.js';
import type { GameSimulation } from '../core/simulation.js';
import type { NightNumber, Vec3 } from '../core/types.js';

interface LanternVisual {
  group: THREE.Group;
  core: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  tearMarks: THREE.Group;
  light: THREE.PointLight;
  ring: THREE.Mesh;
  fuelBarGroup: THREE.Group;
  fuelFill: THREE.Mesh;
  fuelFillMat: THREE.MeshBasicMaterial;
}

interface PulseWave {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  maxRadius: number;
}

const MAX_SHADE_INSTANCES = 256;
const MAX_MOTE_INSTANCES = 160;

export class LanternIslandScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly benchMode: boolean;

  private ambientLight: THREE.AmbientLight;
  private hemiLight: THREE.HemisphereLight;
  private moonLight: THREE.DirectionalLight;
  private fog: THREE.FogExp2;

  private worldGroup = new THREE.Group();
  private currentNight: NightNumber | null = null;

  private playerGroup: THREE.Group;
  private playerLanternLight: THREE.PointLight;
  private orbitOrbs: THREE.Mesh[] = [];

  private lanternVisuals = new Map<string, LanternVisual>();
  private drifterMeshes = new Map<string, THREE.Group>();
  private charmMeshes = new Map<string, THREE.Group>();
  private pulseWaves: PulseWave[] = [];
  private windLeaves: THREE.Points;
  private stars: THREE.Points;

  // High-performance InstancedMesh pools for Shades (200+ in bench) & Motes (100+ in bench)
  private shadeBodyInst: THREE.InstancedMesh;
  private shadeBodyMat: THREE.MeshStandardMaterial;
  private shadeEyeInst: THREE.InstancedMesh;
  private shadeEyeMat: THREE.MeshBasicMaterial;
  private moteCoreInst: THREE.InstancedMesh;
  private moteHaloInst: THREE.InstancedMesh;

  private tmpMatrix = new THREE.Matrix4();
  private tmpPos = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private tmpScale = new THREE.Vector3();
  private tmpEuler = new THREE.Euler();
  private tmpColor = new THREE.Color();
  private tmpCamTarget = new THREE.Vector3();

  private visualTime = 0;
  private cameraShakeTimer = 0;

  constructor(canvas: HTMLCanvasElement, options?: { benchMode?: boolean }) {
    this.benchMode = Boolean(options?.benchMode);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.benchMode ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(
      this.benchMode ? 1280 : window.innerWidth,
      this.benchMode ? 720 : window.innerHeight
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.fog = new THREE.FogExp2(PALETTE.fog, 0.015);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(
      55,
      this.benchMode ? 1280 / 720 : window.innerWidth / window.innerHeight,
      0.1,
      300
    );

    this.ambientLight = new THREE.AmbientLight(0xd8e0ff, 0.15);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x4b5c8a, PALETTE.cloudSea, 0.35);
    this.scene.add(this.hemiLight);

    this.moonLight = new THREE.DirectionalLight(0xcbd5ff, 0.55);
    this.moonLight.position.set(24, 48, -28);
    this.moonLight.castShadow = true;
    this.moonLight.shadow.mapSize.set(1024, 1024);
    this.moonLight.shadow.camera.near = 5;
    this.moonLight.shadow.camera.far = 160;
    const d = 55;
    this.moonLight.shadow.camera.left = -d;
    this.moonLight.shadow.camera.right = d;
    this.moonLight.shadow.camera.top = d;
    this.moonLight.shadow.camera.bottom = -d;
    this.scene.add(this.moonLight);

    this.stars = this.buildSkyAndCloudSea();
    this.windLeaves = this.buildWindLeaves();
    this.scene.add(this.worldGroup);

    // Instanced Shades (bodies + eyes)
    this.shadeBodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: PALETTE.shadeRim,
      emissiveIntensity: 0.65,
      roughness: 0.45,
    });
    this.shadeBodyInst = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.68, 1),
      this.shadeBodyMat,
      MAX_SHADE_INSTANCES
    );
    this.shadeBodyInst.count = 0;
    this.shadeBodyInst.frustumCulled = false;
    this.scene.add(this.shadeBodyInst);

    this.shadeEyeMat = new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim });
    this.shadeEyeInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      this.shadeEyeMat,
      MAX_SHADE_INSTANCES * 2
    );
    this.shadeEyeInst.count = 0;
    this.shadeEyeInst.frustumCulled = false;
    this.scene.add(this.shadeEyeInst);

    // Instanced Motes (cores + halos)
    this.moteCoreInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: PALETTE.moteCore }),
      MAX_MOTE_INSTANCES
    );
    this.moteCoreInst.count = 0;
    this.moteCoreInst.frustumCulled = false;
    this.scene.add(this.moteCoreInst);

    this.moteHaloInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.36, 8, 8),
      new THREE.MeshBasicMaterial({
        color: PALETTE.moteHalo,
        transparent: true,
        opacity: 0.35,
      }),
      MAX_MOTE_INSTANCES
    );
    this.moteHaloInst.count = 0;
    this.moteHaloInst.frustumCulled = false;
    this.scene.add(this.moteHaloInst);

    const { group, lanternLight } = this.buildPlayerMay();
    this.playerGroup = group;
    this.playerLanternLight = lanternLight;
    this.scene.add(this.playerGroup);

    if (!this.benchMode) {
      window.addEventListener('resize', this.handleResize);
    }
  }

  getRendererInfo(): string {
    try {
      const gl = this.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        const gpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        if (gpu) return `Three.js 0.170.0 / WebGL2 (${String(gpu)})`;
      }
    } catch {
      // ignore
    }
    return 'Three.js 0.170.0 / WebGL2';
  }

  triggerCameraShake(duration = 0.25): void {
    this.cameraShakeTimer = Math.max(this.cameraShakeTimer, duration);
  }

  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private buildSkyAndCloudSea(): THREE.Points {
    const cloudGeo = new THREE.PlaneGeometry(500, 500);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: PALETTE.cloudSea,
      roughness: 1,
      metalness: 0,
    });
    const cloudPlane = new THREE.Mesh(cloudGeo, cloudMat);
    cloudPlane.rotation.x = -Math.PI / 2;
    cloudPlane.position.y = -11.5;
    this.scene.add(cloudPlane);

    const starCount = 400;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = ((i * 137.5) % 360) * (Math.PI / 180);
      const phi = Math.acos(0.15 + ((i * 0.618033) % 0.85));
      const r = 160;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: PALETTE.lanternCore,
      size: 0.9,
      transparent: true,
      opacity: 0.7,
    });
    const stars = new THREE.Points(geo, mat);
    this.scene.add(stars);
    return stars;
  }

  private buildWindLeaves(): THREE.Points {
    const count = 160;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = ((i * 37) % 90) - 45;
      pos[i * 3 + 1] = 1 + ((i * 19) % 12);
      pos[i * 3 + 2] = ((i * 53) % 90) - 45;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: PALETTE.lanternLit,
      size: 0.45,
      transparent: true,
      opacity: 0.85,
    });
    const points = new THREE.Points(geo, mat);
    points.visible = false;
    this.scene.add(points);
    return points;
  }

  private clearDynamicEntities(): void {
    for (const v of this.lanternVisuals.values()) this.scene.remove(v.group);
    this.lanternVisuals.clear();
    for (const d of this.drifterMeshes.values()) this.scene.remove(d);
    this.drifterMeshes.clear();
    for (const c of this.charmMeshes.values()) this.scene.remove(c);
    this.charmMeshes.clear();
  }

  private rebuildWorldForNight(night: NightNumber): void {
    this.currentNight = night;
    this.clearDynamicEntities();
    while (this.worldGroup.children.length > 0) {
      this.worldGroup.remove(this.worldGroup.children[0]);
    }

    const grassMat = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.92 });
    const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.95 });
    const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.88 });
    const padMat = new THREE.MeshStandardMaterial({
      color: PALETTE.goldTrim,
      emissive: PALETTE.lanternLit,
      emissiveIntensity: 0.85,
    });

    if (night === 1) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(40, 37, 4, 56), grassMat);
      disc.position.y = -2;
      disc.receiveShadow = true;
      this.worldGroup.add(disc);

      const rim = new THREE.Mesh(new THREE.RingGeometry(36.5, 40, 56), sandMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.02;
      this.worldGroup.add(rim);

      // Creative landmarks disabled in benchMode per Ticket-04 standard bench scene rule
      if (!this.benchMode) {
        const dock = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 8), woodMat);
        dock.position.set(0, 0.05, -42.5);
        this.worldGroup.add(dock);
        const boat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 3.8), woodMat);
        boat.position.set(4.0, -0.4, -44.5);
        boat.rotation.y = 0.3;
        this.worldGroup.add(boat);
      }
    } else if (night === 2) {
      for (const cx of [0, 70]) {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(28, 25, 4, 48), grassMat);
        disc.position.set(cx, -2, 0);
        disc.receiveShadow = true;
        this.worldGroup.add(disc);

        const rim = new THREE.Mesh(new THREE.RingGeometry(25.2, 28, 48), sandMat);
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(cx, 0.02, 0);
        this.worldGroup.add(rim);
      }

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 4), woodMat);
      bridge.position.set(35, -0.175, 0);
      bridge.receiveShadow = true;
      this.worldGroup.add(bridge);

      for (const [px, py, pz] of [
        [20, 0, 18],
        [50, 0, -18],
      ]) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.2, 20), padMat);
        pad.position.set(px, py + 0.1, pz);
        this.worldGroup.add(pad);
      }
    } else {
      const tier0 = new THREE.Mesh(new THREE.CylinderGeometry(45, 42, 4, 60), grassMat);
      tier0.position.y = -2;
      tier0.receiveShadow = true;
      this.worldGroup.add(tier0);

      const rim = new THREE.Mesh(new THREE.RingGeometry(42, 45, 60), sandMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.02;
      this.worldGroup.add(rim);

      const shape = new THREE.Shape();
      shape.absarc(0, 0, 24, 0, Math.PI, false);
      shape.lineTo(-12, 0);
      shape.absarc(0, 0, 12, Math.PI, 0, true);
      shape.closePath();
      const tier1Geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
      tier1Geo.rotateX(Math.PI / 2);
      const tier1 = new THREE.Mesh(tier1Geo, grassMat);
      tier1.position.y = 3;
      tier1.receiveShadow = true;
      tier1.castShadow = true;
      this.worldGroup.add(tier1);

      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 36), grassMat);
      tier2.position.y = 3;
      tier2.receiveShadow = true;
      tier2.castShadow = true;
      this.worldGroup.add(tier2);

      const rampLen = Math.hypot(6, 3);
      const rampPitch = Math.atan2(3, 6);
      for (const deg of [30, 150]) {
        const rad = (deg * Math.PI) / 180;
        const midR = 27;
        const rampGroup = new THREE.Group();
        rampGroup.position.set(Math.cos(rad) * midR, 1.5, Math.sin(rad) * midR);
        rampGroup.rotation.y = -rad;
        const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.3, 3.0), woodMat);
        rampMesh.rotation.z = -rampPitch;
        rampMesh.receiveShadow = true;
        rampMesh.castShadow = true;
        rampGroup.add(rampMesh);
        this.worldGroup.add(rampGroup);
      }

      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.2, 20), padMat);
      pad.position.set(0, 3.1, 13);
      this.worldGroup.add(pad);

      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 8.0, 20), woodMat);
      tower.position.set(0, 10, 0);
      tower.castShadow = true;
      this.worldGroup.add(tower);

      const bell = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 1.8, 16),
        new THREE.MeshStandardMaterial({
          color: PALETTE.goldTrim,
          metalness: 0.6,
          roughness: 0.3,
        })
      );
      bell.position.set(0, 14.5, 0);
      this.worldGroup.add(bell);
    }
  }

  private buildPlayerMay(): { group: THREE.Group; lanternLight: THREE.PointLight } {
    const group = new THREE.Group();

    const cloak = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.15, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayCloak, roughness: 0.75 })
    );
    cloak.position.y = 0.6;
    cloak.castShadow = true;
    group.add(cloak);

    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.08, 8, 16),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayScarfAndCharm, roughness: 0.6 })
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.08;
    group.add(scarf);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.7 })
    );
    head.position.y = 1.28;
    group.add(head);

    const hat = new THREE.Mesh(
      new THREE.ConeGeometry(0.68, 0.42, 20),
      new THREE.MeshStandardMaterial({
        color: PALETTE.sand,
        roughness: 0.8,
        side: THREE.DoubleSide,
      })
    );
    hat.position.y = 1.56;
    hat.castShadow = true;
    group.add(hat);

    const tinyLantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 10, 10),
      new THREE.MeshStandardMaterial({
        color: PALETTE.lanternLit,
        emissive: PALETTE.lanternCore,
        emissiveIntensity: 2.0,
      })
    );
    tinyLantern.position.set(0, 1.12, 0.52);
    group.add(tinyLantern);

    const lanternLight = new THREE.PointLight(PALETTE.lanternLit, 2.2, 12, 1.6);
    lanternLight.position.set(0, 1.35, 0.55);
    group.add(lanternLight);

    const orbGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const orbMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteCore });
    for (let i = 0; i < 10; i++) {
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.visible = false;
      group.add(orb);
      this.orbitOrbs.push(orb);
    }

    return { group, lanternLight };
  }

  private createLanternVisual(id: string, pos: Vec3): LanternVisual {
    const group = new THREE.Group();
    group.position.set(pos[0], pos[1], pos[2]);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.9, 0.6, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.lanternUnlit, roughness: 0.9 })
    );
    base.position.y = 0.3;
    group.add(base);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 2.8, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 })
    );
    pillar.position.y = 1.9;
    pillar.castShadow = true;
    group.add(pillar);

    const coreMat = new THREE.MeshStandardMaterial({
      color: PALETTE.lanternUnlit,
      emissive: PALETTE.lanternLit,
      emissiveIntensity: 0.05,
      roughness: 0.35,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 1), coreMat);
    core.position.y = 3.5;
    group.add(core);

    const tearMarks = new THREE.Group();
    tearMarks.position.y = 3.5;
    const tearMat = new THREE.MeshBasicMaterial({ color: 0x1a1520 });
    for (let i = 0; i < 4; i++) {
      const tear = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.08), tearMat);
      const a = (i * Math.PI) / 2;
      tear.position.set(Math.cos(a) * 0.54, 0, Math.sin(a) * 0.54);
      tear.rotation.y = -a;
      tear.rotation.z = 0.42;
      tearMarks.add(tear);
    }
    group.add(tearMarks);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 })
    );
    roof.position.y = 4.25;
    group.add(roof);

    const fuelBarGroup = new THREE.Group();
    fuelBarGroup.position.y = 5.1;
    const fuelBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x0e1430, side: THREE.DoubleSide })
    );
    const fuelFillMat = new THREE.MeshBasicMaterial({
      color: PALETTE.lanternLit,
      side: THREE.DoubleSide,
    });
    const fuelFill = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.16), fuelFillMat);
    fuelFill.position.z = 0.01;
    fuelBarGroup.add(fuelBg, fuelFill);
    fuelBarGroup.visible = false;
    group.add(fuelBarGroup);

    const light = new THREE.PointLight(PALETTE.lanternLit, 0, 22, 1.5);
    light.position.y = 3.5;
    group.add(light);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5.85, 6.05, 36),
      new THREE.MeshBasicMaterial({
        color: PALETTE.lanternLit,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);

    this.scene.add(group);
    const vis = {
      group,
      core,
      coreMat,
      tearMarks,
      light,
      ring,
      fuelBarGroup,
      fuelFill,
      fuelFillMat,
    };
    this.lanternVisuals.set(id, vis);
    return vis;
  }

  private createDrifterVisual(id: string): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.drifter,
      emissive: PALETTE.drifter,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 1.8), mat);
    group.add(ribbon);
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 4), mat);
    wing.rotation.x = Math.PI / 2;
    group.add(wing);
    this.scene.add(group);
    this.drifterMeshes.set(id, group);
    return group;
  }

  private createCharmVisual(id: string): THREE.Group {
    const group = new THREE.Group();
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.85, 0.08),
      new THREE.MeshStandardMaterial({
        color: PALETTE.mayScarfAndCharm,
        emissive: PALETTE.mayScarfAndCharm,
        emissiveIntensity: 0.5,
      })
    );
    group.add(card);
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.93, 0.04),
      new THREE.MeshBasicMaterial({ color: PALETTE.goldTrim })
    );
    group.add(border);
    this.scene.add(group);
    this.charmMeshes.set(id, group);
    return group;
  }

  spawnPulseEffect(pos: Vec3, maxRadius: number): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.0, 36),
      new THREE.MeshBasicMaterial({
        color: PALETTE.lanternCore,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos[0], pos[1] + 0.3, pos[2]);
    this.scene.add(mesh);
    this.pulseWaves.push({ mesh, age: 0, maxAge: 0.5, maxRadius });
  }

  projectToScreen(pos: Vec3): { x: number; y: number; inFront: boolean; onScreen: boolean } {
    const v = new THREE.Vector3(pos[0], pos[1] + 2.0, pos[2]);
    v.project(this.camera);
    const inFront = v.z < 1;
    const onScreen = inFront && Math.abs(v.x) <= 0.92 && Math.abs(v.y) <= 0.9;
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      inFront,
      onScreen,
    };
  }

  private syncEntitiesCommon(
    sim: GameSimulation,
    dt: number,
    colorblind: boolean,
    reducedMotion: boolean
  ): void {
    if (this.currentNight !== sim.night) {
      this.rebuildWorldForNight(sim.night);
    }

    if (sim.state !== 'paused') {
      this.visualTime += dt;
    }

    // Player
    this.playerGroup.position.set(sim.player.pos[0], sim.player.pos[1], sim.player.pos[2]);
    this.playerGroup.rotation.y = sim.player.facingYaw;
    const blinkHidden =
      sim.player.respawnTicks > 0 ||
      (!reducedMotion &&
        sim.player.invulnTicks > 0 &&
        Math.floor(this.visualTime * 16) % 2 === 0);
    this.playerGroup.visible = !blinkHidden;
    this.playerLanternLight.intensity = 2.0 + Math.sin(this.visualTime * 5) * 0.2;

    const visualOrbs = this.benchMode ? 0 : Math.min(this.orbitOrbs.length, sim.player.carried);
    for (let i = 0; i < this.orbitOrbs.length; i++) {
      const orb = this.orbitOrbs[i];
      if (i < visualOrbs) {
        orb.visible = true;
        const a = this.visualTime * 2.5 + (i * Math.PI * 2) / Math.max(1, visualOrbs);
        orb.position.set(
          Math.cos(a) * 0.9,
          1.25 + Math.sin(this.visualTime * 3.5 + i) * 0.14,
          Math.sin(a) * 0.9
        );
      } else {
        orb.visible = false;
      }
    }

    // Lanterns
    let litCount = 0;
    const blink1Hz = Math.sin(this.visualTime * Math.PI * 2) >= 0;
    for (const l of sim.lanterns) {
      let vis = this.lanternVisuals.get(l.id);
      if (!vis) vis = this.createLanternVisual(l.id, l.pos);
      vis.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
      const fuelPct = l.fuelSixtieths / 6000;
      const isLowFuel = l.lit && l.fuelSixtieths < 1800;

      if (l.lit) {
        litCount++;
        vis.core.scale.set(1, 1, 1);
        vis.tearMarks.visible = false;
        vis.fuelBarGroup.visible = true;
        vis.fuelBarGroup.lookAt(this.camera.position);
        vis.fuelFill.scale.x = Math.max(0.01, fuelPct);
        vis.fuelFill.position.x = -0.8 * (1 - fuelPct);

        if (isLowFuel) {
          vis.coreMat.color.setHex(blink1Hz ? PALETTE.lanternCore : PALETTE.lanternUnlit);
          vis.coreMat.emissive.setHex(PALETTE.lanternLit);
          vis.coreMat.emissiveIntensity = blink1Hz ? 1.8 : 0.35;
          vis.light.intensity = blink1Hz ? 4.2 : 1.2;
          vis.fuelFillMat.color.setHex(
            colorblind ? PALETTE.uiDangerColorblind : PALETTE.uiDanger
          );
          vis.fuelFill.visible = blink1Hz;
          (vis.ring.material as THREE.MeshBasicMaterial).opacity = 0;
        } else {
          vis.coreMat.color.setHex(PALETTE.lanternCore);
          vis.coreMat.emissive.setHex(PALETTE.lanternLit);
          vis.coreMat.emissiveIntensity = 2.2;
          vis.light.intensity = 5.5;
          vis.fuelFillMat.color.setHex(PALETTE.lanternLit);
          vis.fuelFill.visible = true;
          (vis.ring.material as THREE.MeshBasicMaterial).opacity = 0.25;
        }
      } else {
        const cost = l.everLit ? sim.tuning.relight_cost : sim.tuning.lantern_cost;
        const prog = l.deposited / Math.max(1, cost);
        vis.core.scale.set(1, 0.8, 1);
        vis.tearMarks.visible = true;
        vis.fuelBarGroup.visible = false;
        vis.coreMat.color.setHex(PALETTE.lanternUnlit);
        vis.coreMat.emissiveIntensity = 0.05 + prog * 1.1;
        vis.light.intensity = prog * 1.8;
        (vis.ring.material as THREE.MeshBasicMaterial).opacity = 0;
      }
      vis.core.rotation.y = this.visualTime * (l.lit ? 1.2 : 0.3);
    }

    const ratio = sim.lanterns.length > 0 ? litCount / sim.lanterns.length : 0;
    this.ambientLight.intensity = 0.15 + 0.55 * ratio;
    (this.stars.material as THREE.PointsMaterial).opacity = 0.55 + ratio * 0.45;

    // Instanced Motes (1 draw call for cores + 1 for halos)
    const moteCount = Math.min(sim.motes.length, MAX_MOTE_INSTANCES);
    this.moteCoreInst.count = moteCount;
    this.moteHaloInst.count = moteCount;
    this.tmpQuat.identity();
    this.tmpScale.set(1, 1, 1);
    for (let i = 0; i < moteCount; i++) {
      const m = sim.motes[i];
      const bob = 0.65 + Math.sin(this.visualTime * 3.2 + m.pos[0] + m.pos[2]) * 0.2;
      this.tmpPos.set(m.pos[0], m.pos[1] + bob, m.pos[2]);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.moteCoreInst.setMatrixAt(i, this.tmpMatrix);
      this.moteHaloInst.setMatrixAt(i, this.tmpMatrix);
    }
    this.moteCoreInst.instanceMatrix.needsUpdate = true;
    this.moteHaloInst.instanceMatrix.needsUpdate = true;

    // Instanced Shades (1 draw call for bodies + 1 for eyes)
    const rimHex = colorblind ? PALETTE.shadeRimColorblind : PALETTE.shadeRim;
    this.shadeBodyMat.emissive.setHex(rimHex);
    this.shadeEyeMat.color.setHex(rimHex);

    const shadeCount = Math.min(sim.shades.length, MAX_SHADE_INSTANCES);
    this.shadeBodyInst.count = shadeCount;
    this.shadeEyeInst.count = shadeCount * 2;

    for (let i = 0; i < shadeCount; i++) {
      const s = sim.shades[i];
      const hover = Math.sin(this.visualTime * 4 + s.pos[0]) * 0.12;
      const sy = s.pos[1] + hover;
      const yaw =
        s.state === 'stunned'
          ? this.visualTime * 7
          : Math.atan2(sim.player.pos[0] - s.pos[0], sim.player.pos[2] - s.pos[2]);
      const sc =
        s.state === 'stunned'
          ? 0.84
          : s.state === 'spawning'
            ? 0.6
            : s.state === 'drain'
              ? 1.15
              : 1.0;

      this.tmpPos.set(s.pos[0], sy, s.pos[2]);
      this.tmpEuler.set(0, yaw, 0);
      this.tmpQuat.setFromEuler(this.tmpEuler);
      this.tmpScale.set(sc, sc, sc);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.shadeBodyInst.setMatrixAt(i, this.tmpMatrix);

      this.tmpColor.setHex(s.state === 'stunned' ? PALETTE.shadeStunned : PALETTE.shadeBody);
      this.shadeBodyInst.setColorAt(i, this.tmpColor);

      // Left & right eyes transformed by yaw
      const sinY = Math.sin(yaw);
      const cosY = Math.cos(yaw);
      const eyeFwd = 0.56 * sc;
      const eyeSide = 0.22 * sc;
      const eyeY = sy + 0.14 * sc;
      this.tmpScale.set(sc, sc, sc);
      this.tmpQuat.identity();

      this.tmpPos.set(
        s.pos[0] + sinY * eyeFwd - cosY * eyeSide,
        eyeY,
        s.pos[2] + cosY * eyeFwd + sinY * eyeSide
      );
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.shadeEyeInst.setMatrixAt(i * 2, this.tmpMatrix);

      this.tmpPos.set(
        s.pos[0] + sinY * eyeFwd + cosY * eyeSide,
        eyeY,
        s.pos[2] + cosY * eyeFwd - sinY * eyeSide
      );
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.shadeEyeInst.setMatrixAt(i * 2 + 1, this.tmpMatrix);
    }
    this.shadeBodyInst.instanceMatrix.needsUpdate = true;
    if (this.shadeBodyInst.instanceColor) this.shadeBodyInst.instanceColor.needsUpdate = true;
    this.shadeEyeInst.instanceMatrix.needsUpdate = true;

    // Drifters
    const activeDrifterIds = new Set(sim.drifters.map((d) => d.id));
    for (const [id, g] of this.drifterMeshes) {
      if (!activeDrifterIds.has(id)) {
        this.scene.remove(g);
        this.drifterMeshes.delete(id);
      }
    }
    for (const d of sim.drifters) {
      let g = this.drifterMeshes.get(d.id);
      if (!g) g = this.createDrifterVisual(d.id);
      g.position.set(d.pos[0], d.pos[1] + Math.sin(this.visualTime * 6) * 0.25, d.pos[2]);
      g.rotation.y = this.visualTime * 3;
    }

    // Charms
    const activeCharmIds = new Set(sim.charms.map((c) => c.id));
    for (const [id, g] of this.charmMeshes) {
      if (!activeCharmIds.has(id)) {
        this.scene.remove(g);
        this.charmMeshes.delete(id);
      }
    }
    for (const c of sim.charms) {
      let g = this.charmMeshes.get(c.id);
      if (!g) g = this.createCharmVisual(c.id);
      g.visible = c.available;
      g.position.set(c.pos[0], c.pos[1] + 1.0 + Math.sin(this.visualTime * 3) * 0.18, c.pos[2]);
      g.rotation.y = this.visualTime * 1.8;
    }

    // Wind leaves
    const showWind = !this.benchMode && (sim.wind.active || sim.wind.warning);
    this.windLeaves.visible = showWind;
    if (showWind && sim.state !== 'paused') {
      const wRad = (sim.wind.dirDeg * Math.PI) / 180;
      const speed = sim.wind.active ? 18 : 7;
      const attr = this.windLeaves.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < attr.count; i++) {
        let x = attr.getX(i) + Math.cos(wRad) * speed * dt;
        let z = attr.getZ(i) + Math.sin(wRad) * speed * dt;
        if (x > 45) x -= 90;
        if (x < -45) x += 90;
        if (z > 45) z -= 90;
        if (z < -45) z += 90;
        attr.setXYZ(i, x, attr.getY(i), z);
      }
      attr.needsUpdate = true;
    }

    // Pulse waves
    for (let i = this.pulseWaves.length - 1; i >= 0; i--) {
      const pw = this.pulseWaves[i];
      if (sim.state !== 'paused') pw.age += dt;
      if (pw.age >= pw.maxAge) {
        this.scene.remove(pw.mesh);
        pw.mesh.geometry.dispose();
        (pw.mesh.material as THREE.Material).dispose();
        this.pulseWaves.splice(i, 1);
      } else {
        const t = pw.age / pw.maxAge;
        pw.mesh.scale.setScalar(0.5 + t * pw.maxRadius);
        (pw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.85;
      }
    }
  }

  sync(
    sim: GameSimulation,
    camYawDeg: number,
    dt: number,
    colorblind = false,
    reducedMotion = false
  ): void {
    this.syncEntitiesCommon(sim, dt, colorblind, reducedMotion);

    const theta = (camYawDeg * Math.PI) / 180;
    const camDist = 12.5;
    const camHeight = 6.8;
    this.tmpCamTarget.set(
      sim.player.pos[0] - Math.sin(theta) * camDist,
      sim.player.pos[1] + camHeight,
      sim.player.pos[2] - Math.cos(theta) * camDist
    );

    if (this.cameraShakeTimer > 0) {
      this.cameraShakeTimer = Math.max(0, this.cameraShakeTimer - dt);
      if (!reducedMotion) {
        this.tmpCamTarget.x += Math.sin(this.visualTime * 55) * 0.35;
        this.tmpCamTarget.y += Math.cos(this.visualTime * 62) * 0.25;
      }
    }

    this.camera.position.lerp(this.tmpCamTarget, Math.min(1, dt * 10));
    this.camera.lookAt(sim.player.pos[0], sim.player.pos[1] + 1.4, sim.player.pos[2]);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Standard Benchmark Scene render: camera orbits (0,0,0) at radius 30m, Y=15m,
   * starting at 0 deg (30,15,0), rotating CCW (15s per revolution).
   */
  syncBench(sim: GameSimulation, orbitAngleRad: number, dt: number): void {
    this.syncEntitiesCommon(sim, dt, false, false);
    this.camera.position.set(
      Math.cos(orbitAngleRad) * 30,
      15,
      Math.sin(orbitAngleRad) * 30
    );
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
