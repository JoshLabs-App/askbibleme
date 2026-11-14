import XCTest
final class AcceptanceTests: XCTestCase {
    func testDevotionalHandoffAndPreference() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "me.askbible.devotional.acceptance")
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)"]
        app.launch()
        let toggle = app.switches["devotional.afterReading"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 10))
        if toggle.value as? String == "1" { toggle.tap() }
        XCTAssertEqual(toggle.value as? String, "0")
        XCTAssertTrue(app.buttons["devotional.play"].waitForExistence(timeout: 20))
        toggle.tap()
        XCTAssertEqual(toggle.value as? String, "1")
        app.terminate(); app.launch()
        XCTAssertTrue(toggle.waitForExistence(timeout: 10))
        XCTAssertEqual(toggle.value as? String, "1")
        XCTAssertTrue(app.buttons["devotional.play"].waitForExistence(timeout: 20))
        app.buttons["播放计划"].tap()
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 7)
        app.activate()
        let status = app.staticTexts["harness.status"]
        let playing = NSPredicate(format: "label BEGINSWITH %@", "2|1|true|false")
        expectation(for: playing, evaluatedWith: status)
        waitForExpectations(timeout: 40)
        var shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "autoplay-devotional"; shot.lifetime = .keepAlways; add(shot)
        app.buttons["停止"].tap()
        toggle.tap()
        app.buttons["播放计划"].tap()
        let stopped = NSPredicate(format: "label == %@", "4|1|false|false")
        expectation(for: stopped, evaluatedWith: status); waitForExpectations(timeout: 15)
        toggle.tap()
        app.buttons["播放计划"].tap()
        app.buttons["下一章"].tap(); app.buttons["下一章"].tap()
        XCTAssertTrue(status.label.hasSuffix("false|false"))
        app.buttons["devotional.play"].tap()
        let manual = NSPredicate(format: "label CONTAINS %@", "|true|false")
        expectation(for: manual, evaluatedWith: status); waitForExpectations(timeout: 30)
        shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "manual-devotional"; shot.lifetime = .keepAlways; add(shot)
    }
    func testDarkModeLargeText() {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "me.askbible.devotional.acceptance")
        app.launchArguments = ["-AppleLanguages", "(zh-Hans)", "-devotional-dark",
                               "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.switches["devotional.afterReading"].waitForExistence(timeout: 15))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "dark-large-text"; shot.lifetime = .keepAlways; add(shot)
        XCUIDevice.shared.orientation = .landscapeLeft
        expectation(for: NSPredicate { _, _ in
            app.windows.firstMatch.frame.width > app.windows.firstMatch.frame.height
        }, evaluatedWith: nil)
        waitForExpectations(timeout: 10)
        Thread.sleep(forTimeInterval: 1)
        let landscape = XCTAttachment(screenshot: app.screenshot())
        landscape.name = "landscape-large-text"; landscape.lifetime = .keepAlways; add(landscape)
        XCUIDevice.shared.orientation = .portrait
    }
}
