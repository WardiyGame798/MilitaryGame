(function () {
  let sceneRef = null;
  let shilkaRoot = null;
  let hullGroup = null;
  let turretGroup = null;
  let gunGroup = null;
  let radarDish = null;

  let posX = 0;
  let posZ = 16;
  let heading = 0;
  let turretYaw = 0;
  let gunPitch = 0.05;
  let animHookInstalled = false;

  function getGroundY(x, z) {
    if (window.Terrain3D && typeof window.Terrain3D.getGroundHeightAt === "function") {
      return window.Terrain3D.getGroundHeightAt(x, z);
    }
    return 0;
  }

  function buildShilkaModel(THREE) {
    const root = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x556448,
      roughness: 0.78,
      metalness: 0.18
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x2c332b,
      roughness: 0.85,
      metalness: 0.25
    });
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x383d3b,
      roughness: 0.45,
      metalness: 0.65
    });
    const radarMat = new THREE.MeshStandardMaterial({
      color: 0x6b785c,
      roughness: 0.65,
      metalness: 0.25
    });

    // Thân xe & cụm xích
    hullGroup = new THREE.Group();

    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.15, 5.4), hullMat);
    mainHull.position.set(0, 0.95, 0);
    hullGroup.add(mainHull);

    const glacis = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.55, 1.4), hullMat);
    glacis.position.set(0, 1.15, -2.55);
    glacis.rotation.x = 0.42;
    hullGroup.add(glacis);

    [-1.22, 1.22].forEach((sideX) => {
      const track = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 5.55), darkMat);
      track.position.set(sideX, 0.42, 0);
      hullGroup.add(track);
    });

    root.add(hullGroup);

    // Tháp pháo
    turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.55, 0.1);

    const turretBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.05, 2.75), hullMat);
    turretBody.position.set(0, 0.5, 0);
    turretGroup.add(turretBody);

    const turretTop = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.25, 2.2), hullMat);
    turretTop.position.set(0, 1.12, 0.1);
    turretGroup.add(turretTop);

    // Radar nóc tháp pháo
    const radarBase = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), darkMat);
    radarBase.position.set(0, 1.38, 0.55);
    turretGroup.add(radarBase);

    radarDish = new THREE.Group();
    radarDish.position.set(0, 1.65, 0.55);
    const dishPanel = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.62, 0.14), radarMat);
    dishPanel.rotation.x = -0.35;
    radarDish.add(dishPanel);
    turretGroup.add(radarDish);

    // Cụm 4 nòng pháo 23mm (2 nòng trái, 2 nòng phải)
    gunGroup = new THREE.Group();
    gunGroup.position.set(0, 0.55, -1.35);

    const leftCradle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 1.1), darkMat);
    leftCradle.position.set(-1.28, 0, -0.2);
    gunGroup.add(leftCradle);

    const rightCradle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 1.1), darkMat);
    rightCradle.position.set(1.28, 0, -0.2);
    gunGroup.add(rightCradle);

    const barrelGeo = new THREE.CylinderGeometry(0.055, 0.075, 2.85, 10);
    barrelGeo.rotateX(Math.PI / 2);

    const barrelOffsets = [
      [-1.42, 0.11, -1.75],
      [-1.14, -0.11, -1.75],
      [1.14, 0.11, -1.75],
      [1.42, -0.11, -1.75]
    ];

    barrelOffsets.forEach(([bx, by, bz]) => {
      const barrel = new THREE.Mesh(barrelGeo, gunMat);
      barrel.position.set(bx, by, bz);
      gunGroup.add(barrel);
    });

    turretGroup.add(gunGroup);
    root.add(turretGroup);

    return root;
  }

  function updatePose() {
    if (!shilkaRoot) return;
    const groundY = getGroundY(posX, posZ);
    shilkaRoot.position.set(posX, groundY, posZ);
    shilkaRoot.rotation.y = heading;

    if (turretGroup) {
      turretGroup.rotation.y = turretYaw;
    }
    if (gunGroup) {
      gunGroup.rotation.x = gunPitch;
    }
    if (radarDish) {
      radarDish.rotation.y += 0.035;
    }
  }

  function installTickLoop() {
    if (animHookInstalled) return;
    animHookInstalled = true;

    function tick() {
      requestAnimationFrame(tick);
      if (shilkaRoot && sceneRef) {
        updatePose();
      }
    }
    tick();
  }

  function findScene(THREE) {
    if (window.Terrain3D && typeof window.Terrain3D.getScene === "function") {
      return window.Terrain3D.getScene();
    }
    let found = null;
    if (window.THREE && THREE.Object3D) {
      // Dự phòng nếu chưa có getter trực tiếp
    }
    return found;
  }

  function initShilka3D(targetScene) {
    const THREE = window.THREE;
    if (!THREE) return false;

    const scene = targetScene || findScene(THREE);
    if (!scene) return false;

    if (!shilkaRoot) {
      shilkaRoot = buildShilkaModel(THREE);
      scene.add(shilkaRoot);
      sceneRef = scene;
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
      updatePose();
    },
    getState: () => ({ posX, posZ, heading, turretYaw, gunPitch })
  };
})();
