(function () {
  let sceneRef = null;
  let shilkaRoot = null;
  let chassisGroup = null;
  let turretGroup = null;
  let gunGroup = null;
  let radarMount = null;
  let radarDishPivot = null;

  let roadWheels = [];
  let trackLinks = [];
  let barrelMeshes = [];
  let barrelRecoil = [0, 0, 0, 0];
  let muzzleFlashes = [];
  let shellCasings = [];

  let posX = 0;
  let posZ = 16;
  let heading = 0;
  let turretYaw = 0;
  let gunPitch = 0.08;

  let radarDeployed = true;
  let radarFoldProgress = 1;
  let isFiring = false;
  let fireCooldown = 0;
  let burstBarrelIdx = 0;

  let lastX = 0;
  let lastZ = 16;
  let lastHeading = 0;
  let trackScroll = 0;
  let animLoopStarted = false;

  function getGroundY(x, z) {
    if (window.Terrain3D && typeof window.Terrain3D.getGroundHeightAt === "function") {
      return window.Terrain3D.getGroundHeightAt(x, z);
    }
    return 0;
  }

  function buildShilkaModel(THREE) {
    const root = new THREE.Group();

    const armorGreen = new THREE.MeshStandardMaterial({
      color: 0x4f6143,
      roughness: 0.72,
      metalness: 0.22
    });
    const armorDark = new THREE.MeshStandardMaterial({
      color: 0x364230,
      roughness: 0.78,
      metalness: 0.28
    });
    const trackRubberMat = new THREE.MeshStandardMaterial({
      color: 0x222522,
      roughness: 0.9,
      metalness: 0.15
    });
    const wheelRimMat = new THREE.MeshStandardMaterial({
      color: 0x5d6d4e,
      roughness: 0.65,
      metalness: 0.35
    });
    const gunSteelMat = new THREE.MeshStandardMaterial({
      color: 0x2f3332,
      roughness: 0.38,
      metalness: 0.75
    });
    const radarMat = new THREE.MeshStandardMaterial({
      color: 0x677558,
      roughness: 0.58,
      metalness: 0.35
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4a238,
      roughness: 0.32,
      metalness: 0.85
    });

    roadWheels = [];
    trackLinks = [];
    barrelMeshes = [];
    muzzleFlashes = [];
    shellCasings = [];

    // 1. KHUNG GẦM, 6 BÁNH ĐỠ & DẢI XÍCH
    chassisGroup = new THREE.Group();

    const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.85, 5.4), armorDark);
    lowerHull.position.set(0, 0.72, 0);
    chassisGroup.add(lowerHull);

    const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.55, 4.3), armorGreen);
    upperDeck.position.set(0, 1.32, 0.35);
    chassisGroup.add(upperDeck);

    // Mũi xe vát chéo đặc trưng
    const glacisLower = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.52, 1.45), armorGreen);
    glacisLower.position.set(0, 0.96, -2.42);
    glacisLower.rotation.x = 0.52;
    chassisGroup.add(glacisLower);

    const glacisUpper = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.32, 1.25), armorGreen);
    glacisUpper.position.set(0, 1.38, -1.95);
    glacisUpper.rotation.x = 0.24;
    chassisGroup.add(glacisUpper);

    // Cụm đèn/cửa nắp trước và lưới tản nhiệt hông
    const headLampMat = new THREE.MeshStandardMaterial({ color: 0xe9e2c0, roughness: 0.3 });
    [-0.92, 0.92].forEach((lx) => {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 12), headLampMat);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(lx, 1.32, -2.52);
      chassisGroup.add(lamp);
    });

    [-1.38, 1.38].forEach((sx) => {
      const sideBox = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 1.4), armorDark);
      sideBox.position.set(sx, 1.28, -0.35);
      chassisGroup.add(sideBox);

      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 5.5), armorGreen);
      fender.position.set(sx * 0.96, 1.12, 0);
      chassisGroup.add(fender);
    });

    // 6 bánh đỡ mỗi bên + bánh dẫn động/bánh căng xích
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.42, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.46, 12);
    hubGeo.rotateZ(Math.PI / 2);

    const wheelZPositions = [-2.05, -1.23, -0.41, 0.41, 1.23, 2.05];
    [-1.22, 1.22].forEach((sideX) => {
      wheelZPositions.forEach((wz) => {
        const wheelPivot = new THREE.Group();
        wheelPivot.position.set(sideX, 0.42, wz);

        const tire = new THREE.Mesh(wheelGeo, trackRubberMat);
        const rim = new THREE.Mesh(hubGeo, wheelRimMat);
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.56), wheelRimMat);

        wheelPivot.add(tire, rim, spoke);
        chassisGroup.add(wheelPivot);
        roadWheels.push(wheelPivot);
      });

      // Các mắt xích chạy dọc theo vành xích
      const linkGeo = new THREE.BoxGeometry(0.54, 0.12, 0.24);
      const linkCount = 26;
      for (let i = 0; i < linkCount; i++) {
        const link = new THREE.Mesh(linkGeo, trackRubberMat);
        chassisGroup.add(link);
        trackLinks.push({
          mesh: link,
          sideX,
          ratio: i / linkCount
        });
      }
    });

    root.add(chassisGroup);

    // 2. THÁP PHÁO XOAY ĐỘC LẬP
    turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.56, 0.18);

    const turretLower = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.62, 2.75), armorGreen);
    turretLower.position.set(0, 0.31, 0);
    turretGroup.add(turretLower);

    const turretUpper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.48, 2.35), armorGreen);
    turretUpper.position.set(0, 0.78, 0.05);
    turretGroup.add(turretUpper);

    // Má tháp bo vát hai bên
    [-1.16, 1.16].forEach((tx) => {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.52, 2.15), armorDark);
      cheek.position.set(tx, 0.48, -0.05);
      turretGroup.add(cheek);
    });

    // Cửa nóc tháp pháo
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.12, 14), armorDark);
    hatch.position.set(-0.42, 1.05, -0.35);
    turretGroup.add(hatch);

    // 3. RADAR GẬP/MỞ & QUAY QUÉT TRÊN NÓC THÁP PHÁO
    radarMount = new THREE.Group();
    radarMount.position.set(0, 1.02, 0.78);

    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.34, 0.56), armorDark);
    pedestal.position.y = 0.17;
    radarMount.add(pedestal);

    radarDishPivot = new THREE.Group();
    radarDishPivot.position.set(0, 0.34, 0);

    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.22), radarMat);
    mast.position.set(0, 0.32, 0);
    radarDishPivot.add(mast);

    const dishBack = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.68, 0.16), radarMat);
    dishBack.position.set(0, 0.72, 0);
    dishBack.rotation.x = -0.38;
    radarDishPivot.add(dishBack);

    const dishLip = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.12, 0.28), armorDark);
    dishLip.position.set(0, 0.98, -0.08);
    dishLip.rotation.x = -0.38;
    radarDishPivot.add(dishLip);

    radarMount.add(radarDishPivot);
    turretGroup.add(radarMount);

    // 4. CỤM 4 NÒNG PHÁO 23MM (2 CẶP ĐÔI TRÁI - PHẢI)
    gunGroup = new THREE.Group();
    gunGroup.position.set(0, 0.58, -1.25);

    [-1.28, 1.28].forEach((cx) => {
      const mountBlock = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.95), armorDark);
      mountBlock.position.set(cx, 0, -0.15);
      gunGroup.add(mountBlock);

      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.34, 0.14), gunSteelMat);
      brace.position.set(cx, 0, -1.35);
      gunGroup.add(brace);
    });

    const barrelGeo = new THREE.CylinderGeometry(0.052, 0.072, 2.95, 10);
    barrelGeo.rotateX(Math.PI / 2);

    const flashGeo = new THREE.ConeGeometry(0.28, 0.85, 8);
    flashGeo.rotateX(-Math.PI / 2);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffb703,
      transparent: true,
      opacity: 0.9
    });

    const barrelCoords = [
      [-1.42, 0.11, -1.55],
      [-1.14, -0.11, -1.55],
      [1.14, 0.11, -1.55],
      [1.42, -0.11, -1.55]
    ];

    barrelCoords.forEach(([bx, by, bz]) => {
      const barrel = new THREE.Mesh(barrelGeo, gunSteelMat);
      barrel.position.set(bx, by, bz);
      barrel.userData.baseZ = bz;
      gunGroup.add(barrel);
      barrelMeshes.push(barrel);

      const flash = new THREE.Mesh(flashGeo, flashMat.clone());
      flash.position.set(bx, by, bz - 1.75);
      flash.visible = false;
      gunGroup.add(flash);
      muzzleFlashes.push(flash);
    });

    turretGroup.add(gunGroup);
    root.add(turretGroup);

    return root;
  }

  function updateTrackLinks() {
    for (let i = 0; i < trackLinks.length; i++) {
      const item = trackLinks[i];
      const t = (item.ratio + trackScroll) % 1;
      const wrappedT = t < 0 ? t + 1 : t;

      // Vòng chạy theo biên dạng xích: dưới (0..0.42), sau (0.42..0.5), trên (0.5..0.92), trước (0.92..1)
      let lx = item.sideX;
      let ly = 0.08;
      let lz = 0;
      let rotX = 0;

      if (wrappedT < 0.42) {
        const u = wrappedT / 0.42;
        lz = 2.35 - u * 4.7;
        ly = 0.06;
        rotX = 0;
      } else if (wrappedT < 0.5) {
        const u = (wrappedT - 0.42) / 0.08;
        lz = -2.35 + u * 0.25;
        ly = 0.06 + u * 0.88;
        rotX = -0.6;
      } else if (wrappedT < 0.92) {
        const u = (wrappedT - 0.5) / 0.42;
        lz = -2.1 + u * 4.45;
        ly = 0.94;
        rotX = 0;
      } else {
        const u = (wrappedT - 0.92) / 0.08;
        lz = 2.35 - u * 0.15;
        ly = 0.94 - u * 0.88;
        rotX = 0.6;
      }

      item.mesh.position.set(lx, ly, lz);
      item.mesh.rotation.x = rotX;
    }
  }

  function spawnShellCasing(THREE, barrel) {
    if (!gunGroup || shellCasings.length > 18) return;
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6),
      new THREE.MeshStandardMaterial({ color: 0xe0b13a, metalness: 0.85, roughness: 0.3 })
    );
    shell.position.set(
      barrel.position.x + (barrel.position.x < 0 ? -0.18 : 0.18),
      barrel.position.y + 0.14,
      barrel.position.z + 0.35
    );
    shell.userData.vx = (barrel.position.x < 0 ? -1 : 1) * (1.8 + Math.random() * 1.2);
    shell.userData.vy = 2.2 + Math.random() * 1.2;
    shell.userData.vz = 0.8 + Math.random() * 0.8;
    shell.userData.life = 1.0;
    gunGroup.add(shell);
    shellCasings.push(shell);
  }

  function stepFiringEffects(THREE) {
    if (isFiring && fireCooldown <= 0) {
      fireCooldown = 0.075;
      const idx = burstBarrelIdx % barrelMeshes.length;
      burstBarrelIdx++;

      barrelRecoil[idx] = 0.28;
      const flash = muzzleFlashes[idx];
      if (flash) {
        flash.visible = true;
        flash.scale.setScalar(0.8 + Math.random() * 0.55);
      }
      spawnShellCasing(THREE, barrelMeshes[idx]);
    }

    if (fireCooldown > 0) {
      fireCooldown = Math.max(0, fireCooldown - 0.016);
    }

    for (let i = 0; i < barrelMeshes.length; i++) {
      barrelRecoil[i] = Math.max(0, barrelRecoil[i] - 0.035);
      barrelMeshes[i].position.z = barrelMeshes[i].userData.baseZ + barrelRecoil[i];

      if (muzzleFlashes[i] && barrelRecoil[i] < 0.14) {
        muzzleFlashes[i].visible = false;
      }
    }

    for (let i = shellCasings.length - 1; i >= 0; i--) {
      const s = shellCasings[i];
      s.position.x += s.userData.vx * 0.016;
      s.position.y += s.userData.vy * 0.016;
      s.position.z += s.userData.vz * 0.016;
      s.userData.vy -= 9.8 * 0.016;
      s.rotation.x += 0.25;
      s.rotation.z += 0.2;
      s.userData.life -= 0.03;

      if (s.userData.life <= 0 || s.position.y < -0.5) {
        if (gunGroup) gunGroup.remove(s);
        shellCasings.splice(i, 1);
      }
    }
  }

  function updatePose() {
    if (!shilkaRoot) return;
    const THREE = window.THREE;

    const dx = posX - lastX;
    const dz = posZ - lastZ;
    const dHead = heading - lastHeading;
    const forwardMove = Math.hypot(dx, dz) * (Math.cos(heading) * -dz + Math.sin(heading) * -dx >= 0 ? 1 : -1);
    const turnMove = dHead * 1.4;
    const wheelDelta = (forwardMove + turnMove) * 1.8;

    trackScroll += wheelDelta * 0.18;
    lastX = posX;
    lastZ = posZ;
    lastHeading = heading;

    const groundY = getGroundY(posX, posZ);
    shilkaRoot.position.set(posX, groundY, posZ);
    shilkaRoot.rotation.y = heading;

    roadWheels.forEach((w) => {
      w.rotation.x -= wheelDelta;
    });
    updateTrackLinks();

    if (turretGroup) {
      turretGroup.rotation.y = turretYaw;
    }
    if (gunGroup) {
      gunGroup.rotation.x = gunPitch;
    }

    // Gập/mở radar mượt mà (1 = dựng sẵn sàng, 0 = gập gọn sát nóc)
    const targetFold = radarDeployed ? 1 : 0;
    radarFoldProgress += (targetFold - radarFoldProgress) * 0.12;
    if (radarDishPivot) {
      radarDishPivot.rotation.x = -(1 - radarFoldProgress) * 1.25;
      if (radarFoldProgress > 0.25) {
        radarDishPivot.rotation.y += 0.04 * radarFoldProgress;
      }
    }

    if (THREE) {
      stepFiringEffects(THREE);
    }
  }

  function installTickLoop() {
    if (animLoopStarted) return;
    animLoopStarted = true;

    function tick() {
      requestAnimationFrame(tick);
      if (shilkaRoot && sceneRef) {
        updatePose();
      }
    }
    tick();
  }

  function findScene() {
    if (window.Terrain3D && typeof window.Terrain3D.getScene === "function") {
      return window.Terrain3D.getScene();
    }
    return null;
  }

  function initShilka3D(targetScene) {
    const THREE = window.THREE;
    if (!THREE) return false;

    const scene = targetScene || findScene();
    if (!scene) return false;

    if (!shilkaRoot) {
      shilkaRoot = buildShilkaModel(THREE);
      scene.add(shilkaRoot);
      sceneRef = scene;
      lastX = posX;
      lastZ = posZ;
      lastHeading = heading;
      updatePose();
      installTickLoop();
    }
    return true;
  }

  window.Shilka3D = {
    init: initShilka3D,
    setTransform: ({ x, z, yaw, turret, pitch } = {}) => {
      if (typeof x === "number") posX = x;
      if (typeof z === "number") posZ = z;
      if (typeof yaw === "number") heading = yaw;
      if (typeof turret === "number") turretYaw = turret;
      if (typeof pitch === "number") gunPitch = Math.max(-0.15, Math.min(1.2, pitch));
    },
    setFiring: (active) => {
      isFiring = Boolean(active);
    },
    triggerBurst: (shots = 6) => {
      isFiring = true;
      setTimeout(() => {
        isFiring = false;
      }, Math.max(120, shots * 75));
    },
    setRadarDeployed: (deployed) => {
      radarDeployed = Boolean(deployed);
    },
    toggleRadar: () => {
      radarDeployed = !radarDeployed;
      return radarDeployed;
    },
    getState: () => ({
      posX,
      posZ,
      heading,
      turretYaw,
      gunPitch,
      radarDeployed,
      isFiring
    })
  };
})();
