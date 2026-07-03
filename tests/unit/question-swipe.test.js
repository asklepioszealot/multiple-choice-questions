// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bindQuestionSwipe } from "../../src/features/study/question-swipe.js";

function pointerEvent(type, { x = 0, y = 0, pointerId = 1, timeStamp } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    clientX: x, clientY: y, pointerId, pointerType: "touch", button: 0,
  });
  if (timeStamp !== undefined) {
    Object.defineProperty(event, "timeStamp", { value: timeStamp });
  }
  return event;
}

describe("bindQuestionSwipe", () => {
  let card;
  let onSwipeLeft;
  let onSwipeRight;

  beforeEach(() => {
    card = document.createElement("div");
    document.body.appendChild(card);
    onSwipeLeft = vi.fn();
    onSwipeRight = vi.fn();
    bindQuestionSwipe(card, { onSwipeLeft, onSwipeRight });
  });

  it("sola yeterli kaydırma sonraki soruyu tetikler", () => {
    card.dispatchEvent(pointerEvent("pointerdown", { x: 200, y: 100, timeStamp: 1000 }));
    card.dispatchEvent(pointerEvent("pointerup", { x: 120, y: 105, timeStamp: 1200 }));
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("sağa yeterli kaydırma önceki soruyu tetikler", () => {
    card.dispatchEvent(pointerEvent("pointerdown", { x: 100, y: 100, timeStamp: 1000 }));
    card.dispatchEvent(pointerEvent("pointerup", { x: 180, y: 100, timeStamp: 1200 }));
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it("kısa yatay hareket swipe sayılmaz (şık tıklaması güvenli)", () => {
    card.dispatchEvent(pointerEvent("pointerdown", { x: 100, y: 100, timeStamp: 1000 }));
    card.dispatchEvent(pointerEvent("pointerup", { x: 130, y: 100, timeStamp: 1100 }));
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("dikey sürüklenme swipe sayılmaz", () => {
    card.dispatchEvent(pointerEvent("pointerdown", { x: 200, y: 100, timeStamp: 1000 }));
    card.dispatchEvent(pointerEvent("pointerup", { x: 120, y: 160, timeStamp: 1200 }));
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("swipe sonrası sentetik click bastırılır, ilk click bastırılmaz", () => {
    const clickSpy = vi.fn();
    card.addEventListener("click", clickSpy);

    // Swipe'sız ilk click bastırılmamalı (fc d7bb06c regresyonu)
    card.dispatchEvent(pointerEvent("pointerdown", { x: 100, y: 100, timeStamp: 10 }));
    card.dispatchEvent(pointerEvent("pointerup", { x: 100, y: 100, timeStamp: 20 }));
    const firstClick = new Event("click", { bubbles: true, cancelable: true });
    Object.defineProperty(firstClick, "timeStamp", { value: 30 });
    card.dispatchEvent(firstClick);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Swipe'ı takip eden click bastırılmalı
    card.dispatchEvent(pointerEvent("pointerdown", { x: 200, y: 100, timeStamp: 1000 }));
    card.dispatchEvent(pointerEvent("pointerup", { x: 120, y: 100, timeStamp: 1150 }));
    const syntheticClick = new Event("click", { bubbles: true, cancelable: true });
    Object.defineProperty(syntheticClick, "timeStamp", { value: 1200 });
    card.dispatchEvent(syntheticClick);
    expect(clickSpy).toHaveBeenCalledTimes(1); // artmadı
  });
});
