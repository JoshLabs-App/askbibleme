import SwiftUI
import UIKit
import UIKit.UIGestureRecognizerSubclass

/// 在 window 上挂一个「不吞事件、允许同时识别」的手势识别器：页面里任何触碰都回调一次（RN root onTouchStart）。
/// 不用 SwiftUI 的 DragGesture(minimumDistance: 0) 当触碰探测：iOS 26 真机上它会把下面的 Button 点击吃掉（Josh 2026-09-10：音乐页点播放没反应）。
/// 放在页面里当一个 0×0 的隐形 view，页面在屏上就在听，页面走了就摘掉。
struct TouchObserver: UIViewRepresentable {
    var onTouch: () -> Void

    func makeUIView(context: Context) -> ObserverView {
        let v = ObserverView()
        v.onTouch = onTouch
        v.isUserInteractionEnabled = false
        return v
    }
    func updateUIView(_ v: ObserverView, context: Context) { v.onTouch = onTouch }
    static func dismantleUIView(_ v: ObserverView, coordinator: ()) { v.detach() }

    final class ObserverView: UIView, UIGestureRecognizerDelegate {
        var onTouch: (() -> Void)?
        private var recognizer: AnyTouchRecognizer?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            detach()
            guard let window else { return }
            let r = AnyTouchRecognizer(target: self, action: #selector(fire(_:)))
            r.cancelsTouchesInView = false
            r.delaysTouchesBegan = false
            r.delaysTouchesEnded = false
            r.delegate = self
            window.addGestureRecognizer(r)
            recognizer = r
        }

        func detach() {
            if let r = recognizer { r.view?.removeGestureRecognizer(r) }
            recognizer = nil
        }

        @objc private func fire(_ r: UIGestureRecognizer) {
            if r.state == .began { onTouch?() }
        }

        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool { false }
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRequireFailureOf other: UIGestureRecognizer) -> Bool { false }
    }

    /// 一碰就 began、抬手就 ended，不判断位移，不影响别的识别器
    final class AnyTouchRecognizer: UIGestureRecognizer {
        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) { if state == .possible { state = .began } }
        override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) { if state == .began { state = .changed } }
        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) { state = .ended }
        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) { state = .cancelled }
    }
}

/// RN stack 的右滑返回：window 上挂一个自定义识别器 —— 只盯从左缘 32pt 内起手的触摸，横向拖过 80pt 才「识别成功」；
/// 识别成功那一刻 UIKit 取消底下视图的触摸（cancelsTouchesInView），从卡片上起手也不会误开卡片；
/// 没识别前完全不拦、不延迟（不用 UIScreenEdgePanGestureRecognizer：它会把左缘 30pt 内的点按吃掉，返回箭头正好在那里）。
/// 多页叠着时只有最后挂上的（最上层）那页响应。
struct EdgeSwipeBack: UIViewRepresentable {
    var action: () -> Void

    func makeUIView(context: Context) -> ObserverView {
        let v = ObserverView()
        v.action = action
        v.isUserInteractionEnabled = false
        return v
    }
    func updateUIView(_ v: ObserverView, context: Context) { v.action = action }
    static func dismantleUIView(_ v: ObserverView, coordinator: ()) { v.detach() }

    final class ObserverView: UIView, UIGestureRecognizerDelegate {
        static var stack: [ObserverView] = []
        var action: (() -> Void)?
        private var recognizer: EdgeSwipeRecognizer?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            detach()
            guard let window else { return }
            let r = EdgeSwipeRecognizer(target: self, action: #selector(fire(_:)))
            r.cancelsTouchesInView = true
            r.delaysTouchesBegan = false
            r.delaysTouchesEnded = false
            r.delegate = self
            window.addGestureRecognizer(r)
            recognizer = r
            Self.stack.append(self)
        }

        func detach() {
            if let r = recognizer { r.view?.removeGestureRecognizer(r) }
            recognizer = nil
            Self.stack.removeAll { $0 === self }
        }

        @objc private func fire(_ r: UIGestureRecognizer) {
            if r.state == .began, Self.stack.last === self { action?() }
        }

        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldBeRequiredToFailBy other: UIGestureRecognizer) -> Bool { false }
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRequireFailureOf other: UIGestureRecognizer) -> Bool { false }
    }

    final class EdgeSwipeRecognizer: UIGestureRecognizer {
        static let edge: CGFloat = 32
        static let distance: CGFloat = 80
        private var start: CGPoint?

        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
            guard state == .possible, start == nil, let t = touches.first, let view else { return }
            let p = t.location(in: view)
            if p.x < Self.edge, touches.count == 1 { start = p } else { state = .failed }
        }
        override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
            guard state == .possible, let start, let t = touches.first, let view else { return }
            let p = t.location(in: view)
            let dx = p.x - start.x, dy = abs(p.y - start.y)
            if dy > 60, dx < Self.distance { state = .failed; return }
            if dx >= Self.distance, dy < 80 { state = .began }
        }
        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
            state = (state == .began || state == .changed) ? .ended : .failed
        }
        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
            state = (state == .began || state == .changed) ? .cancelled : .failed
        }
        override func reset() { super.reset(); start = nil }
    }
}

extension View {
    func edgeSwipeBack(_ action: @escaping () -> Void) -> some View {
        overlay(EdgeSwipeBack(action: action).frame(width: 0, height: 0))
    }
}
