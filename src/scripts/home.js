const widgetImagePaths = [
  "assets/widgets/w1.jpg",
  "assets/widgets/w2.jpg",
  "assets/widgets/w3.jpg",
  "assets/widgets/w4.jpg",
  "assets/widgets/w5.jpg",
];

const imageWidget = document.querySelector("#image-widget");
const widgetImage = document.querySelector("#widget-image");
const nextWidgetImage = document.querySelector("#widget-image-next");
const collectionList = document.querySelector(".collection-list");
const collectionItems = [...document.querySelectorAll(".collection-link")].map((link) => ({
  label: link.textContent,
  href: link.getAttribute("href"),
}));
const collectionSlotOffsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const collectionSlots = collectionSlotOffsets.map((position) => {
  const link = document.createElement("a");
  link.className = "collection-link";
  return { link, position };
});
const collectionLinks = collectionSlots.map(({ link }) => link);

collectionList.replaceChildren(...collectionLinks);

let currentImageIndex = 0;
let availableWidgetImagePaths = [];
let collectionPosition = 0;
let targetCollectionPosition = 0;
let collectionAnimationFrame = null;
let collectionSettleTimer = null;
let wheelDistance = 0;
let wheelStartCenter = null;
let collectionAnimationStartPosition = 0;
let collectionAnimationStartedAt = null;
let dragStartY = 0;
let dragStartPosition = 0;
let isDraggingCollections = false;
let hasDraggedCollection = false;
let pressedCollectionLink = null;
let isWidgetImageTransitioning = false;

function startWidgetImageTimer() {
  imageWidget.classList.remove("is-counting");
  void imageWidget.offsetWidth;
  imageWidget.classList.add("is-counting");
}

function showNextWidgetImage() {
  if (availableWidgetImagePaths.length === 0 || isWidgetImageTransitioning) {
    return;
  }

  const nextImageIndex = (currentImageIndex + 1) % availableWidgetImagePaths.length;
  const nextImagePath = availableWidgetImagePaths[nextImageIndex];
  let hasStartedFade = false;

  function startImageFade() {
    if (hasStartedFade) {
      return;
    }

    hasStartedFade = true;
    isWidgetImageTransitioning = true;
    startWidgetImageTimer();
    window.requestAnimationFrame(() => {
      nextWidgetImage.classList.add("is-visible");
    });

    window.setTimeout(() => {
      widgetImage.src = nextImagePath;
      currentImageIndex = nextImageIndex;
      nextWidgetImage.classList.remove("is-visible");
      nextWidgetImage.removeAttribute("src");
      isWidgetImageTransitioning = false;
    }, 520);
  }

  nextWidgetImage.addEventListener("load", startImageFade, { once: true });
  nextWidgetImage.src = nextImagePath;

  if (nextWidgetImage.complete) {
    startImageFade();
  }
}

widgetImage.addEventListener("error", () => {
  imageWidget.classList.add("is-empty");
});

widgetImage.addEventListener("load", () => {
  imageWidget.classList.remove("is-empty");
});

function verifyWidgetImage(path) {
  return new Promise((resolve) => {
    const image = new Image();

    image.addEventListener("load", () => resolve(path));
    image.addEventListener("error", () => resolve(null));
    image.src = path;
  });
}

Promise.all(widgetImagePaths.map(verifyWidgetImage)).then((paths) => {
  availableWidgetImagePaths = paths.filter(Boolean);

  if (availableWidgetImagePaths.length === 0) {
    imageWidget.classList.add("is-empty");
    return;
  }

  currentImageIndex = 0;
  widgetImage.src = availableWidgetImagePaths[currentImageIndex];
  startWidgetImageTimer();
  window.setInterval(showNextWidgetImage, 3000);
});

function getCollectionIndex(index) {
  return ((index % collectionItems.length) + collectionItems.length) % collectionItems.length;
}

function recycleCollectionSlots() {
  collectionSlots.forEach((slot) => {
    if (slot.position < collectionPosition - 4) {
      slot.position += collectionSlots.length;
    } else if (slot.position > collectionPosition + 4) {
      slot.position -= collectionSlots.length;
    }
  });
}

function renderCollectionCarousel() {
  recycleCollectionSlots();

  const widgetBounds = imageWidget.getBoundingClientRect();
  const listBounds = collectionList.getBoundingClientRect();
  const widgetCenterX = widgetBounds.left + widgetBounds.width / 2 - listBounds.left;
  const widgetCenterY = widgetBounds.top + widgetBounds.height / 2 - listBounds.top;
  const orbitRadius = Math.min(Math.max(widgetBounds.width * 0.78, 210), 340);

  collectionSlots.forEach(({ link, position }) => {
    const distance = position - collectionPosition;
    const collectionItem = collectionItems[getCollectionIndex(position)];
    const angle = distance * 0.54;
    const scale = Math.max(0.55, 1.28 - Math.abs(distance) * 0.25);
    const opacity = Math.max(0, 1 - Math.abs(distance) * 0.5);

    if (link.textContent !== collectionItem.label) {
      link.textContent = collectionItem.label;
      link.href = collectionItem.href;
    }

    link.style.left = `${widgetCenterX + Math.cos(angle) * orbitRadius}px`;
    link.style.top = `${widgetCenterY + Math.sin(angle) * orbitRadius}px`;
    link.style.setProperty("--item-scale", scale);
    link.style.opacity = opacity;
    link.style.pointerEvents = opacity < 0.1 ? "none" : "auto";
    link.style.zIndex = String(10 - Math.round(Math.abs(distance) * 2));
    link.setAttribute("aria-current", Math.abs(distance) < 0.5 ? "true" : "false");
    link.classList.toggle("is-centered", Math.abs(distance) < 0.18);
  });
}

function stopCollectionAnimation() {
  if (collectionAnimationFrame !== null) {
    window.cancelAnimationFrame(collectionAnimationFrame);
    collectionAnimationFrame = null;
  }

  collectionAnimationStartedAt = null;
}

function animateCollectionCarousel(now) {
  if (collectionAnimationStartedAt === null) {
    collectionAnimationStartedAt = now;
  }

  const progress = Math.min((now - collectionAnimationStartedAt) / 280, 1);
  const easedProgress = 1 - (1 - progress) ** 3;
  collectionPosition = collectionAnimationStartPosition
    + (targetCollectionPosition - collectionAnimationStartPosition) * easedProgress;
  renderCollectionCarousel();

  if (progress === 1) {
    collectionPosition = targetCollectionPosition;
    renderCollectionCarousel();
    collectionAnimationFrame = null;
    collectionAnimationStartedAt = null;
    return;
  }

  collectionAnimationFrame = window.requestAnimationFrame(animateCollectionCarousel);
}

function updateCollectionTarget(nextPosition) {
  stopCollectionAnimation();
  targetCollectionPosition = nextPosition;
  collectionAnimationStartPosition = collectionPosition;

  collectionAnimationFrame = window.requestAnimationFrame(animateCollectionCarousel);
}

function settleWheelCollection() {
  wheelDistance = 0;
  wheelStartCenter = null;
}

function scheduleWheelSettle() {
  window.clearTimeout(collectionSettleTimer);
  collectionSettleTimer = window.setTimeout(settleWheelCollection, 110);
}

window.addEventListener("wheel", (event) => {
  event.preventDefault();

  if (wheelStartCenter === null) {
    wheelStartCenter = Math.round(targetCollectionPosition);
  }

  wheelDistance += event.deltaY;
  const direction = Math.sign(wheelDistance);
  const turns = Math.max(1, Math.min(4, Math.round(Math.abs(wheelDistance) / 180)));
  updateCollectionTarget(wheelStartCenter + direction * turns);
  scheduleWheelSettle();
}, { passive: false });

collectionList.addEventListener("pointerdown", (event) => {
  isDraggingCollections = true;
  hasDraggedCollection = false;
  pressedCollectionLink = event.target.closest(".collection-link");
  window.clearTimeout(collectionSettleTimer);
  wheelDistance = 0;
  wheelStartCenter = null;
  stopCollectionAnimation();
  targetCollectionPosition = collectionPosition;
  collectionAnimationStartPosition = collectionPosition;
  dragStartY = event.clientY;
  dragStartPosition = collectionPosition;
  collectionList.setPointerCapture(event.pointerId);
});

collectionList.addEventListener("pointermove", (event) => {
  if (!isDraggingCollections) {
    return;
  }

  if (Math.abs(dragStartY - event.clientY) > 6) {
    hasDraggedCollection = true;
  }

  collectionPosition = dragStartPosition + (dragStartY - event.clientY) / 110;
  renderCollectionCarousel();
});

collectionList.addEventListener("pointerup", (event) => {
  isDraggingCollections = false;
  collectionList.releasePointerCapture(event.pointerId);
  const centerPosition = Math.round(collectionPosition);
  updateCollectionTarget(centerPosition);

  if (pressedCollectionLink && !hasDraggedCollection) {
    window.location.assign(pressedCollectionLink.href);
  }

  pressedCollectionLink = null;
});

collectionList.addEventListener("pointercancel", () => {
  isDraggingCollections = false;
  pressedCollectionLink = null;
  const centerPosition = Math.round(collectionPosition);
  updateCollectionTarget(centerPosition);
});

window.addEventListener("resize", renderCollectionCarousel);
renderCollectionCarousel();
