import { useEffect, useRef } from "react";
import * as THREE from "three";

type InteractiveWorldCupBallProps = {
  modelUrl?: string;
  onFirstTouch?: () => void;
};

type DragState = {
  active: boolean;
  hasInteracted: boolean;
  pointerId: number | null;
  lastPoint: THREE.Vector3;
  lastTime: number;
};

export function InteractiveWorldCupBall({
  modelUrl,
  onFirstTouch,
}: InteractiveWorldCupBallProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onFirstTouchRef = useRef(onFirstTouch);

  useEffect(() => {
    onFirstTouchRef.current = onFirstTouch;
  }, [onFirstTouch]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = "start-ball-canvas";
    renderer.domElement.setAttribute("aria-label", "Interactive World Cup ball");
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x24375f, 2.4));

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 6);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7ee6dc, 1.6);
    rimLight.position.set(-4, 1, 4);
    scene.add(rimLight);

    const ball = new THREE.Group();
    ball.position.set(0, 0, 0);
    ball.rotation.set(-0.2, 0.45, 0.15);
    scene.add(ball);

    const shadow = createShadow();
    scene.add(shadow);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const drag: DragState = {
      active: false,
      hasInteracted: false,
      pointerId: null,
      lastPoint: new THREE.Vector3(),
      lastTime: performance.now(),
    };
    const velocity = new THREE.Vector3(0, 0, 0);
    const targetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const worldPoint = new THREE.Vector3();
    let frame = 0;
    let lastFrameTime = performance.now();
    let disposed = false;

    void loadBallObject(ball, modelUrl);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const getWorldPoint = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      raycaster.ray.intersectPlane(targetPlane, worldPoint);

      return worldPoint;
    };

    const handlePointerDown = (event: PointerEvent) => {
      getWorldPoint(event);
      raycaster.setFromCamera(pointer, camera);

      if (raycaster.intersectObjects(ball.children, true).length === 0) {
        return;
      }

      event.preventDefault();
      drag.active = true;
      if (!drag.hasInteracted) {
        onFirstTouchRef.current?.();
      }
      drag.hasInteracted = true;
      drag.pointerId = event.pointerId;
      drag.lastPoint.copy(worldPoint);
      drag.lastTime = performance.now();
      velocity.set(0, 0, 0);
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.classList.add("has-interacted", "is-grabbing");
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      const nextPoint = getWorldPoint(event).clone();
      const now = performance.now();
      const deltaSeconds = Math.max(0.016, (now - drag.lastTime) / 1000);
      const delta = nextPoint.clone().sub(drag.lastPoint);

      ball.position.x = nextPoint.x;
      ball.position.y = nextPoint.y;
      velocity.set(
        delta.x / deltaSeconds,
        delta.y / deltaSeconds,
        THREE.MathUtils.clamp(delta.y / deltaSeconds, -7, 7),
      );
      ball.rotation.x += delta.y * 1.25;
      ball.rotation.y += delta.x * 1.25;
      drag.lastPoint.copy(nextPoint);
      drag.lastTime = now;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!drag.active || drag.pointerId !== event.pointerId) {
        return;
      }

      drag.active = false;
      drag.pointerId = null;
      renderer.domElement.releasePointerCapture(event.pointerId);
      renderer.domElement.classList.remove("is-grabbing");
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerUp);

    const animate = (now: number) => {
      if (disposed) {
        return;
      }

      const deltaSeconds = Math.min(0.04, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      if (!drag.active && drag.hasInteracted) {
        velocity.y -= 1.7 * deltaSeconds;
        ball.position.x += velocity.x * deltaSeconds;
        ball.position.y += velocity.y * deltaSeconds;
        ball.position.z += velocity.z * deltaSeconds;
        velocity.multiplyScalar(0.994);
        bounceWithinView(ball, velocity, camera);
        ball.rotation.x += velocity.y * deltaSeconds * 1.6;
        ball.rotation.y += velocity.x * deltaSeconds * 1.6;
      }

      const depthScale = THREE.MathUtils.mapLinear(ball.position.z, -3.2, 1.2, 0.52, 1.06);
      ball.scale.setScalar(THREE.MathUtils.clamp(depthScale, 0.52, 1.06));
      shadow.visible = drag.hasInteracted;

      if (drag.hasInteracted) {
        ball.rotation.z += deltaSeconds * 0.12;
        shadow.position.x = ball.position.x;
        shadow.position.y = getViewBounds(camera).bottom - 0.15;
        shadow.scale.setScalar(
          THREE.MathUtils.clamp((1.25 - ball.position.y * 0.08) * ball.scale.x, 0.36, 1.4),
        );
      }

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelUrl]);

  return <div className="start-ball-stage" ref={hostRef} />;
}

async function loadBallObject(ball: THREE.Group, modelUrl?: string) {
  if (modelUrl) {
    try {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(modelUrl);
      normalizeModel(gltf.scene);
      ball.add(gltf.scene);
      return;
    } catch {
      // Fall back to the procedural ball if the configured model is unavailable.
    }
  }

  ball.add(createProceduralBall());
}

function createProceduralBall() {
  const texture = createBallTexture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const geometry = new THREE.SphereGeometry(1, 96, 64);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    roughness: 0.42,
    metalness: 0.02,
  });

  return new THREE.Mesh(geometry, material);
}

function createBallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  context.fillStyle = "#fffdf4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawTextureBand(context, "#315bb3", 80, 44, 1.2);
  drawTextureBand(context, "#f05f2f", 420, 130, -0.8);
  drawTextureBand(context, "#1eb6a8", 710, 64, 0.7);
  drawTextureBand(context, "#f1c83b", 235, 320, -1);
  drawTextureBand(context, "#b7193f", 600, 335, 1.1);

  context.globalAlpha = 0.28;
  context.strokeStyle = "#102238";
  context.lineWidth = 2;

  for (let x = 0; x <= canvas.width; x += 128) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 82, canvas.height);
    context.stroke();
  }

  context.globalAlpha = 1;
  context.fillStyle = "#102238";
  context.font = "900 54px Arial, sans-serif";
  context.fillText("2026", 438, 282);

  return new THREE.CanvasTexture(canvas);
}

function drawTextureBand(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  tilt: number,
) {
  context.save();
  context.translate(x, y);
  context.rotate(tilt * 0.35);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(-80, -34);
  context.bezierCurveTo(30, -88, 190, -72, 265, -20);
  context.bezierCurveTo(182, 20, 72, 94, -58, 74);
  context.bezierCurveTo(-98, 38, -110, 0, -80, -34);
  context.fill();
  context.restore();
}

function normalizeModel(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  const scale = maxAxis > 0 ? 2 / maxAxis : 1;

  model.position.sub(center);
  model.scale.setScalar(scale);
}

function createShadow() {
  const geometry = new THREE.CircleGeometry(0.72, 48);
  const material = new THREE.MeshBasicMaterial({
    color: 0x102238,
    opacity: 0.18,
    transparent: true,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(geometry, material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.z = -1.08;

  return shadow;
}

function bounceWithinView(
  ball: THREE.Object3D,
  velocity: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
) {
  const bounds = getViewBounds(camera);
  const radius = ball.scale.x;
  const damping = -0.78;
  const backWall = -3.2;
  const frontWall = 1.2;

  if (ball.position.x < bounds.left + radius) {
    ball.position.x = bounds.left + radius;
    velocity.x *= damping;
  } else if (ball.position.x > bounds.right - radius) {
    ball.position.x = bounds.right - radius;
    velocity.x *= damping;
  }

  if (ball.position.y < bounds.bottom + radius) {
    ball.position.y = bounds.bottom + radius;
    velocity.y *= damping;
  } else if (ball.position.y > bounds.top - radius) {
    ball.position.y = bounds.top - radius;
    velocity.y *= damping;
  }

  if (ball.position.z < backWall) {
    ball.position.z = backWall;
    velocity.z *= damping;
  } else if (ball.position.z > frontWall) {
    ball.position.z = frontWall;
    velocity.z *= damping;
  }
}

function getViewBounds(camera: THREE.PerspectiveCamera) {
  const halfHeight =
    Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const halfWidth = halfHeight * camera.aspect;

  return {
    bottom: -halfHeight,
    left: -halfWidth,
    right: halfWidth,
    top: halfHeight,
  };
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;

    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = mesh.material;

    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material) {
  Object.values(material).forEach((value) => {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  });
  material.dispose();
}
