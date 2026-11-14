import XCTest

/// Runs only against the disposable simulator used by verify-ios-text-selection.sh.
final class SelectionTests: XCTestCase {
    private func openGenesis() -> (XCUIApplication, XCUICoordinate, CGRect) {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "me.askbible")
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-AppleLocale", "zh_CN", "-askbible_app_text_size", "standard"]
        app.launch()
        if app.buttons["开始今日灵修"].waitForExistence(timeout: 2) { app.buttons["开始今日灵修"].tap() }
        if app.buttons["以后再说"].waitForExistence(timeout: 2) { app.buttons["以后再说"].tap() }
        let origin = app.windows.firstMatch.coordinate(withNormalizedOffset: .zero)
        let bibleTab = app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.67, dy: 0.93))
        bibleTab.tap()
        let genesis = app.buttons["01, 创世记"]
        if !genesis.waitForExistence(timeout: 1) { bibleTab.tap() } // Home's idle chrome may be hidden.
        XCTAssertTrue(genesis.waitForExistence(timeout: 3))
        genesis.tap()
        XCTAssertTrue(app.buttons["1"].waitForExistence(timeout: 3))
        app.buttons["1"].tap()
        XCTAssertTrue(app.textViews["read.chapter.text"].waitForExistence(timeout: 3))
        let verse = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "1\u{2002}起初")).firstMatch
        XCTAssertTrue(verse.waitForExistence(timeout: 3))
        let frame = verse.frame
        origin.withOffset(CGVector(dx: frame.midX, dy: frame.midY)).press(forDuration: 0.7)
        XCTAssertTrue(app.menuItems["复制"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.menuItems["收藏"].exists || app.menuItems["取消收藏"].exists)
        XCTAssertFalse(app.menuItems["多选复制"].exists)
        return (app, origin, frame)
    }

    private func attach(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name; shot.lifetime = .keepAlways; add(shot)
    }

    func testSingleVerseCopy() {
        let (app, _, _) = openGenesis()
        attach(app, "single-verse")
        app.menuItems["复制"].tap()
    }

    func testDragAcrossParagraphs() {
        let (app, origin, frame) = openGenesis()
        let text = app.textViews["read.chapter.text"]
        let from = origin.withOffset(CGVector(dx: frame.maxX, dy: frame.maxY + 8))
        let to = origin.withOffset(CGVector(dx: text.frame.maxX - 50, dy: text.frame.maxY - 30))
        from.press(forDuration: 0.2, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 3)
        XCTAssertTrue(app.menuItems["复制"].waitForExistence(timeout: 3))
        attach(app, "cross-screen-selection")
        app.menuItems["复制"].tap()
    }

    func testBookmarkPersists() {
        let (app, _, _) = openGenesis()
        if app.menuItems["取消收藏"].exists { app.menuItems["取消收藏"].tap(); app.terminate() }
        else { app.terminate() }
        let (fresh, _, _) = openGenesis()
        fresh.menuItems["收藏"].tap()
        fresh.terminate()
        let (reopened, _, _) = openGenesis()
        XCTAssertTrue(reopened.menuItems["取消收藏"].exists)
        attach(reopened, "bookmark-reopened")
        reopened.menuItems["取消收藏"].tap() // Restore the disposable fixture.
    }
}
