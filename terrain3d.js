(function () {
  const WORLD_WIDTH = 400;
  const WORLD_DEPTH = 400;
  const SKY_CEILING = 20;
  const UNIT_TO_METERS = 10;

  let scene, camera, renderer, cloudsGroup;
  let initialized = false;
  let animationId = null;
  let retryTimer = null;

  let yaw = 0;
  let pitch = 0.03;
  let camX = 0;
  let camZ = 28;
  let isDraggingLook = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function getDuneHeight(x, z) {
    const wave1 = Math.sin(x * 0.035) * Math.cos(z * 0.035) * 2.4;
    const wave2 = Math.sin((x + z) * 0.075) * 1.1;
    const ridge1 = Math.exp(-((x - 42) ** 2 + (z + 35) ** 2) / 1800) * 4.2;
    const ridge2 = Math.exp(-((x + 55) ** 2 + (z + 50) ** 2) / 2200) * 3.6;
    const ridge3 = Math.exp(-((x + 25) ** 2 + (z - 45) ** 2) / 1900) * 2.8;
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

  function createSandTexture(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#d8b377";
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 240, 200, 0.14)" : "rgba(130, 92, 45, 0.14)";
      ctx.fillRect(x, y, 2, 2);
    }

    ctx.strokeStyle = "rgba(155, 112, 58, 0.18)";
    ctx.lineWidth = 1;
    for (let y = 0; y < 256; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + Math.sin(y) * 3);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(45, 45);
    return tex;
  }

  function createDesertGround(THREE) {
    const geometry = new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_DEPTH, 160, 160);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, getDuneHeight(x, z));
    }
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      map: createSandTexture(THREE),
      roughness: 0.9,
      metalness: 0.04
    });

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }

  function createSunAndSky(THREE) {
    scene.background = new THREE.Color(0x8ecae6);
    scene.fog = new THREE.FogExp2(0xe6cfa3, 0.002);

    scene.add(new THREE.AmbientLight(0xfff4dc, 0.75));
    scene.add(new THREE.HemisphereLight(0x9ad1f5, 0xc99e5b, 0.65));

    const sunLight = new THREE.DirectionalLight(0xfff1c9, 1.5);
    sunLight.position.set(110, SKY_CEILING * 0.85, -90);
    scene.add(sunLight);

    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe27a })
    );
    sunMesh.position.set(135, SKY_CEILING - 2.5, -120);
    scene.add(sunMesh);
  }

  function createClouds(THREE) {
    cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xfaf8f2,
      roughness: 1,
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
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xcab08a, roughness: 0.88 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8f6b48, roughness: 0.9 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x5c4938, roughness: 0.85 });

    const houseSpecs = [
      { x: -32, z: -38, w: 7.0, h: 3.0, d: 5.5, rotY: 0.25 },
      { x: 38, z: -52, w: 8.5, h: 3.4, d: 6.0, rotY: -0.4 },
      { x: 52, z: 24, w: 6.5, h: 2.8, d: 5.0, rotY: 0.7 },
      { x: -58, z: 34, w: 7.5, h: 3.1, d: 5.5, rotY: -0.2 }
    ];

    houseSpecs.forEach((spec) => {
      const groundY = getDuneHeight(spec.x, spec.z);
      const house = new THREE.Group();

      const body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), wallMat);
      body.position.y = spec.h / 2;
      house.add(body);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.6, 0.5, spec.d + 0.6), roofMat);
      roof.position.y = spec.h + 0.25;
      house.add(roof);

      const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.6, 0.25), trimMat);
      door.position.set(0, 0.8, spec.d / 2 + 0.06);
      house.add(door);

      house.position.set(spec.x, groundY - 0.15, spec.z);
      house.rotation.y = spec.rotY;
      housesGroup.add(house);
    });

    scene.add(housesGroup);
  }

  function updateCameraTransform() {
    if (!camera) return;
    const baseY = getDuneHeight(camX, camZ) + 2.4;
    camera.position.set(camX, baseY, camZ);

    const lookDist = 45;
    const dirX = Math.sin(yaw) * Math.cos(pitch);
    const dirY = Math.sin(pitch);
    const dirZ = -Math.cos(yaw) * Math.cos(pitch);

    camera.lookAt(camX + dirX * lookDist, baseY + dirY * lookDist, camZ + dirZ * lookDist);
  }

  function bindLookControls() {
    const viewport = document.getElementById("battle-viewport");
    if (!viewport) return;

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

      yaw -= dx * 0.006;
      pitch = Math.max(-0.35, Math.min(0.55, pitch - dy * 0.004));
      updateCameraTransform();
    });

    window.addEventListener("pointerup", () => {
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
      updateCameraTransform();
      return;
    }

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(65, width / height, 0.2, 650);
    updateCameraTransform();

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "default" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    bindLookControls();

    window.addEventListener("resize", resizeRenderer);
    initialized = true;
    animate();
  }

  window.Terrain3D = {
    init: () => initTerrain3D(0),
    resize: resizeRenderer,
    getGroundHeightAt: getDuneHeight,
    setLookAngles: (newYaw, newPitch) => {
      yaw = newYaw;
      pitch = Math.max(-0.35, Math.min(0.55, newPitch));
      updateCameraTransform();
    },
    getLookAngles: () => ({ yaw, pitch }),
    moveCamera: (dx, dz) => {
      camX = Math.max(-WORLD_WIDTH / 2 + 5, Math.min(WORLD_WIDTH / 2 - 5, camX + dx));
      camZ = Math.max(-WORLD_DEPTH / 2 + 5, Math.min(WORLD_DEPTH / 2 - 5, camZ + dz));
      updateCameraTransform();
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
