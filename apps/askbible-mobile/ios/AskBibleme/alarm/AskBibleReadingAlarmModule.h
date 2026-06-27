#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface AskBibleReadingAlarmModule : RCTEventEmitter <RCTBridgeModule>
@end

/** Swift / AppDelegate 通知唤醒入口 */
@interface AskBibleReadingAlarmBridge : NSObject
+ (void)handleNotificationWake;
@end
