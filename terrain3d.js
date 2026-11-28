(function () {
  const WORLD_WIDTH = 400;
  const WORLD_DEPTH = 400;
  const SKY_CEILING = 20;
  const UNIT_TO_METERS = 10;

  const TURN_SPEED_X = 0.028;
  const TURN_SPEED_Y = 0.016;
  const LOOK_SMOOTHING = 0.28;

  let scene, camera, renderer, cloudsGroup;
  let initialized = false;
  let animationId = null;
  let retryTimer = null;

  let yaw = 0;
  let pitch = 0.03;
  let targetYaw = 0;
  let targetPitch = 0.03;
  let camX = 0;
  let camZ = 28;
  let isDraggingLook = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function clampPitch(val) {
    return Math.max(-0.35, Math.min(0.55, val));
  }

  function getDuneHeight(x, z) {
    const wave1 = Math.sin(x * 0.035) * Math.cos(z * 0.035) * 2.5;
    const wave2 = Math.sin((x + z) * 0.075) * 1.15;
    const ridge1 = Math.exp(-((x - 42) ** 2 + (z + 35) ** 2) / 1800) * 4.4;
    const ridge2 = Math.exp(-((x + 55) ** 2 + (z + 50) ** 2) / 2200) * 3.8;
    const ridge3 = Math.exp(-((x + 25) ** 2 + (z - 45) ** 2) / 1900) * 3.0;
    const flatCenter = 1 - Math.min(1, Math.hypot(x, z - 28) / 14);
    return Math.max(0, (wave1 + wave2 + ridge1 + ridge2 + ridge3) * (1 - flatCenter * 0.75));
  }

  function hidePlaceholder() {
    const placeholder = document.getElementById("scene-placeholder");
    if (placeholder) {
      placeholder.hidden = true;
      placeholder.style.display = "none";
    }
  }

  function createSkyDome(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, "#4ea8de");
    grad.addColorStop(0.45, "#90d5f4");
    grad.addColorStop(0.75, "#e6dec8");
    grad.addColorStop(1.0, "#edd6a4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 256);

    const skyTex = new THREE.CanvasTexture(canvas);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false });
    const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), skyMat);
    scene.add(skyMesh);
  }

  function createSandTexture(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#d5ad6e";
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "rgba(122, 82, 34, 0.22)";
    ctx.lineWidth = 1.5;
    for (let y = 0; y < 512; y += 12) {
      ctx.beginPath();
      for (let x = 0; x <= 512; x += 16) {
        const wy = y + Math.sin(x * 0.04 + y * 0.08) * 3.5;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    for (let i = 0; i < 6500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = i % 3 === 0 ? "rgba(255, 244, 212, 0.2)" : "rgba(96, 63, 25, 0.16)";
      ctx.fillRect(x, y, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(55, 55);
    return tex;
  }

  function createDesertGround(THREE) {
    const geometry = new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_DEPTH, 160, 160);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const lowColor = new THREE.Color(0xc49758);
    const highColor = new THREE.Color(0xe7c88e);
    const tempColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = getDuneHeight(x, z);
      pos.setY(i, y);

      const t = Math.min(1, Math.max(0, y / 5.5));
      tempColor.lerpColors(lowColor, highColor, t);
      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      map: createSandTexture(THREE),
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.03
    });

    return new THREE.Mesh(geometry, material);
  }

  function createSunAndSky(THREE) {
    createSkyDome(THREE);
    scene.fog = new THREE.FogExp2(0xe4cb9b, 0.0018);

    scene.add(new THREE.AmbientLight(0xfff5df, 0.72));
    scene.add(new THREE.HemisphereLight(0x9cd6f7, 0xc79852, 0.65));

    const sunLight = new THREE.DirectionalLight(0xfff0c2, 1.6);
    sunLight.position.set(110, SKY_CEILING * 0.85, -90);
    scene.add(sunLight);

    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe57f })
    );
    sunMesh.position.set(135, SKY_CEILING - 2.5, -120);
    scene.add(sunMesh);
  }

  function createClouds(THREE) {
    cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xfbf9f3,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.92
    });

    const cloudSpots = [
      [-90, 14.5, -110, 1.3],
      [-20, 16.0, -145, 1.6],
      [55, 13.8, -85, 1.1],
      [115, 15.5, -155, 1.5],
      [-130, 14.0, 20, 1.2],
      [75, 16.2, 55, 1.3]
    ];

    cloudSpots.forEach(([cx, cy, cz, scale]) => {
      const cluster = new THREE.Group();
      const parts = [
        [0, 0, 0, 4.2],
        [-3.2, -0.4, 0.8, 2.8],
        [3.4, -0.3, -0.5, 3.0],
        [1.2, 1.1, 0.4, 2.4]
      ];
      parts.forEach(([px, py, pz, r]) => {
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), cloudMat);
        puff.position.set(px, py, pz);
        puff.scale.y = 0.55;
        cluster.add(puff);
      });
      cluster.position.set(cx, Math.min(cy, SKY_CEILING - 2.5), cz);
      cluster.scale.setScalar(scale);
      cloudsGroup.add(cluster);
    });

    scene.add(cloudsGroup);
  }

  function createDesertHouses(THREE) {
    const housesGroup = new THREE.Group();
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x8d7963, roughness: 0.92 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd1b68e, roughness: 0.86 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a5738, roughness: 0.88 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a392b, roughness: 0.82 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x364f5c, roughness: 0.25, metalness: 0.2 });

    const houseSpecs = [
      { x: -24, z: -26, w: 7.2, h: 3.0, d: 5.6, rotY: 0.25 },
      { x: 28, z: -38, w: 8.6, h: 3.4, d: 6.2, rotY: -0.4 },
      { x: 44, z: 18, w: 6.6, h: 2.8, d: 5.0, rotY: 0.7 },
      { x: -48, z: 26, w: 7.6, h: 3.1, d: 5.6, rotY: -0.2 }
    ];

    houseSpecs.forEach((spec) => {
      const groundY = getDuneHeight(spec.x, spec.z);
      const house = new THREE.Group();

      const plinth = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.4, 0.45, spec.d + 0.4), plinthMat);
      plinth.position.y = 0.1;
      house.add(plinth);

      const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), wallMat);
      body.position.y = 0.32 + spec.h / 2;
      house.add(body);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.8, 0.45, spec.d + 0.8), roofMat);
      roof.position.y = 0.32 + spec.h + 0.22;
      house.add(roof);

      const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.7, 0.25), trimMat);
      door.position.set(-spec.w * 0.18, 0.32 + 0.85, spec.d / 2 + 0.08);
      house.add(door);

      const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 0.22), glassMat);
      win.position.set(spec.w * 0.22, 0.32 + 1.55, spec.d / 2 + 0.07);
      house.add(win);

      house.position.set(spec.x, groundY - 0.15, spec.z);
      house.rotation.y = spec.rotY;
      housesGroup.add(house);
    });

    scene.add(housesGroup);
  }

  function createRocksAndScrubs(THREE) {
    const propsGroup = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8f7a61, roughness: 0.94 });
    const scrubMat = new THREE.MeshStandardMaterial({ color: 0x7c8452, roughness: 0.9 });

    const rockCoords = [
      [-12, 10, 1.1], [14, 8, 1.4], [-18, -12, 1.8], [19, -15, 1.2],
      [8, -22, 2.1], [-28, 6, 1.6], [32, 4, 1.9], [-8, 19, 0.95],
      [11, 21, 1.05], [-38, -18, 2.3], [46, -24, 1.7], [0, -45, 2.4]
    ];

    rockCoords.forEach(([rx, rz, rScale], idx) => {
      const y = getDuneHeight(rx, rz);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rScale, 0), rockMat);
      rock.position.set(rx, y + rScale * 0.35, rz);
      rock.scale.set(1.2, 0.72, 1.0);
      rock.rotation.set(idx * 0.4, idx * 0.9, idx * 0.2);
      propsGroup.add(rock);
    });

    const scrubCoords = [
      [-6, 14, 0.8], [7, 13, 0.9], [-15, 2, 1.0], [16, -4, 0.85],
      [-21, -24, 1.1], [23, -10, 0.95], [4, -14, 0.75], [-10, -32, 1.0]
    ];

    scrubCoords.forEach(([sx, sz, sScale]) => {
      const y = getDuneHeight(sx, sz);
      const bush = new THREE.Mesh(new THREE.ConeGeometry(sScale * 0.7, sScale * 0.9, 6), scrubMat);
      bush.position.set(sx, y + sScale * 0.35, sz);
      propsGroup.add(bush);
    });

    scene.add(propsGroup);
  }

  function applyCameraPose() {
    if (!camera) return;

    let anchorX = camX;
    let anchorZ = camZ;
    let anchorYaw = 0;

    if (window.Shilka3D && typeof window.Shilka3D.getState === "function") {
      const st = window.Shilka3D.getState();
      if (typeof st.posX === "number" && typeof st.posZ === "number") {
        anchorX = st.posX;
        anchorZ = st.posZ;
        anchorYaw = st.heading || 0;
      }
    }

    const followDist = 12.5;
    const followHeight = 7.2;
    const totalYaw = anchorYaw + yaw;

    const eyeX = anchorX + Math.sin(totalYaw) * followDist;
    const eyeZ = anchorZ + Math.cos(totalYaw) * followDist;
    const eyeY = getDuneHeight(eyeX, eyeZ) + followHeight;

    camera.position.set(eyeX, eyeY, eyeZ);

    const lookDist = 36;
    const lookX = anchorX - Math.sin(totalYaw) * lookDist;
    const lookZ = anchorZ - Math.cos(totalYaw) * lookDist;
    const lookY = getDuneHeight(anchorX, anchorZ) + 2.2 + Math.sin(pitch) * 18;

    camera.lookAt(lookX, lookY, lookZ);
  }

  function bindLookControls() {
    const viewport = document.getElementById("battle-viewport");
    if (!viewport) return;
    viewport.style.touchAction = "none";

    viewport.addEventListener("pointerdown", (e) => {
      if (e.target && e.target.closest("button, #move-joystick, #radar-widget")) return;
      isDraggingLook = true;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    });

    window.addEventListener("pointermove", (e) => {
      if (!isDraggingLook) return;
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;

      targetYaw -= dx * TURN_SPEED_X;
      targetPitch = clampPitch(targetPitch - dy * TURN_SPEED_Y);
    });

    window.addEventListener("pointerup", () => {
      isDraggingLook = false;
    });

    window.addEventListener("pointercancel", () => {
      isDraggingLook = false;
    });
  }

  function resizeRenderer() {
    const viewport = document.getElementById("battle-viewport");
    if (!viewport || !renderer || !camera) return;
    const width = viewport.clientWidth || window.innerWidth;
    const height = viewport.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function animate() {
    animationId = requestAnimationFrame(animate);

    yaw += (targetYaw - yaw) * LOOK_SMOOTHING;
    pitch += (targetPitch - pitch) * LOOK_SMOOTHING;
    applyCameraPose();

    if (cloudsGroup) {
      cloudsGroup.children.forEach((cloud, idx) => {
        cloud.position.x += 0.012 + idx * 0.002;
        if (cloud.position.x > WORLD_WIDTH * 0.45) {
          cloud.position.x = -WORLD_WIDTH * 0.45;
        }
      });
    }
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  function initTerrain3D(attempt = 0) {
    const THREE = window.THREE;
    const viewport = document.getElementById("battle-viewport");
    if (!THREE || !viewport) {
      if (attempt < 15) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => initTerrain3D(attempt + 1), 200);
      }
      return;
    }

    const width = viewport.clientWidth || window.innerWidth;
    const height = viewport.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) {
      if (attempt < 15) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => initTerrain3D(attempt + 1), 150);
      }
      return;
    }

    hidePlaceholder();

    if (initialized) {
      resizeRenderer();
      applyCameraPose();
      if (window.Shilka3D && typeof window.Shilka3D.init === "function") {
        window.Shilka3D.init(scene);
      }
      return;
    }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(65, width / height, 0.2, 650);
    applyCameraPose();

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "default" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.zIndex = "0";

    viewport.prepend(renderer.domElement);

    createSunAndSky(THREE);
    scene.add(createDesertGround(THREE));
    createClouds(THREE);
    createDesertHouses(THREE);
    createRocksAndScrubs(THREE);
    if (window.Shilka3D && typeof window.Shilka3D.init === "function") {
      window.Shilka3D.init(scene);
    }
    bindLookControls();

    window.addEventListener("resize", resizeRenderer);
    initialized = true;
    animate();
  }

  window.Terrain3D = {
    init: () => initTerrain3D(0),
    resize: resizeRenderer,
    getScene: () => scene,
    getGroundHeightAt: getDuneHeight,
    setLookAngles: (newYaw, newPitch) => {
      targetYaw = newYaw;
      targetPitch = clampPitch(newPitch);
    },
    getLookAngles: () => ({ yaw, pitch }),
    moveCamera: (dx, dz) => {
      camX = Math.max(-WORLD_WIDTH / 2 + 5, Math.min(WORLD_WIDTH / 2 - 5, camX + dx));
      camZ = Math.max(-WORLD_DEPTH / 2 + 5, Math.min(WORLD_DEPTH / 2 - 5, camZ + dz));
      applyCameraPose();
    },
    getBoundsMeters: () => ({
      widthMeters: WORLD_WIDTH * UNIT_TO_METERS,
      depthMeters: WORLD_DEPTH * UNIT_TO_METERS,
      ceilingMeters: SKY_CEILING * UNIT_TO_METERS
    }),
    dispose: () => {
      clearTimeout(retryTimer);
      if (animationId) cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resizeRenderer);
      if (renderer && renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      if (renderer) renderer.dispose();
      initialized = false;
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("btn-start-game");
    if (startBtn) {
      startBtn.addEventListener("click", () => {
        setTimeout(() => initTerrain3D(0), 50);
      });
    }
  });
})();
