#import "AskBibleReadingAlarmModule.h"
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>

static NSString *const kReadingAlarmPrefsSuite = @"askbible_reading_alarm";
static NSString *const kKeyEnabled = @"enabled";
static NSString *const kKeyHour = @"hour";
static NSString *const kKeyMinute = @"minute";
static NSString *const kKeyWeekdays = @"weekdays";
static NSString *const kKeyLabel = @"label";
static NSString *const kKeyBookId = @"book_id";
static NSString *const kKeyChapter = @"chapter";
static NSString *const kKeyBookName = @"book_name";
static NSString *const kKeyTranslationId = @"translation_id";
static NSString *const kKeyPendingAutoPlay = @"pending_auto_play";
static NSString *const kKeyDismissed = @"dismissed";
static NSString *const kKeyPreludeActive = @"prelude_active";
static NSString *const kKeyPreludeStartedAt = @"prelude_started_at";
static NSString *const kKeyMode = @"mode";
static NSString *const kModeMusic = @"music";
static NSString *const kModeScripture = @"scripture";
static NSString *const kKeyLastHandledSlot = @"last_handled_slot";
static NSString *const kReadingReminderNotificationId = @"askbible-reading-reminder";
static NSString *const kReadingReminderWeekdayIdPrefix = @"askbible-reading-reminder-wd-";
static NSString *const kAutoContinueNotificationId = @"askbible-reading-alarm-auto-continue";
static NSString *const kHandoffNotificationId = @"askbible-reading-alarm-handoff";
static const NSTimeInterval kPreludeSeconds = 60.0;
static const NSInteger kAutoStartGraceMinutes = 10;

static AskBibleReadingAlarmModule *gReadingAlarmModuleInstance = nil;

@interface AskBibleReadingAlarmModule ()
@property (nonatomic, strong) AVAudioPlayer *player;
@property (nonatomic, strong) NSTimer *autoContinueTimer;
@property (nonatomic, assign) BOOL sessionContinued;
@property (nonatomic, assign) UIBackgroundTaskIdentifier backgroundTaskId;
- (void)handleNotificationWake;
@end

@implementation AskBibleReadingAlarmBridge

+ (void)handleNotificationWake
{
  [gReadingAlarmModuleInstance handleNotificationWake];
}

@end

@implementation AskBibleReadingAlarmModule

RCT_EXPORT_MODULE(AskBibleReadingAlarm);

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (instancetype)init
{
  if (self = [super init]) {
    gReadingAlarmModuleInstance = self;
    self.backgroundTaskId = UIBackgroundTaskInvalid;
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(onAppDidBecomeActive)
                                                 name:UIApplicationDidBecomeActiveNotification
                                               object:nil];
  }
  return self;
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"ReadingAlarmDismissed", @"ReadingAlarmAutoContinue" ];
}

- (NSUserDefaults *)alarmDefaults
{
  NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:kReadingAlarmPrefsSuite];
  return defaults ?: [NSUserDefaults standardUserDefaults];
}

- (NSSet<NSNumber *> *)parseWeekdays:(id)weekdaysRaw
{
  NSMutableSet<NSNumber *> *weekdays = [NSMutableSet set];
  if ([weekdaysRaw isKindOfClass:[NSArray class]]) {
    for (id item in (NSArray *)weekdaysRaw) {
      NSInteger value = [item integerValue];
      if (value >= 1 && value <= 7) {
        [weekdays addObject:@(value)];
      }
    }
  }
  if (weekdays.count == 0) {
    for (NSInteger day = 1; day <= 7; day++) {
      [weekdays addObject:@(day)];
    }
  }
  return weekdays;
}

- (BOOL)isReadingReminderNotificationId:(NSString *)identifier
{
  return [identifier isEqualToString:kReadingReminderNotificationId] ||
         [identifier hasPrefix:kReadingReminderWeekdayIdPrefix];
}

- (BOOL)isWeekdayEnabled:(NSInteger)weekday prefs:(NSUserDefaults *)prefs
{
  id stored = [prefs objectForKey:kKeyWeekdays];
  if (![stored isKindOfClass:[NSArray class]] || [(NSArray *)stored count] == 0) {
    return YES;
  }
  NSString *value = [NSString stringWithFormat:@"%ld", (long)weekday];
  return [(NSArray *)stored containsObject:value];
}

- (NSString *)currentAlarmSlotKey:(NSUserDefaults *)prefs
{
  NSCalendar *cal = [NSCalendar currentCalendar];
  NSDateComponents *nowComp =
      [cal components:(NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay) fromDate:[NSDate date]];
  return [NSString stringWithFormat:@"%04ld-%02ld-%02ld-%02ld:%02ld",
                                    (long)nowComp.year,
                                    (long)nowComp.month,
                                    (long)nowComp.day,
                                    (long)[prefs integerForKey:kKeyHour],
                                    (long)[prefs integerForKey:kKeyMinute]];
}

- (void)markCurrentSlotHandled
{
  NSUserDefaults *prefs = [self alarmDefaults];
  [prefs setObject:[self currentAlarmSlotKey:prefs] forKey:kKeyLastHandledSlot];
}

- (BOOL)isScriptureMode:(NSUserDefaults *)prefs
{
  NSString *mode = [prefs stringForKey:kKeyMode];
  if (mode.length == 0) {
    return YES;
  }
  return ![mode isEqualToString:kModeMusic];
}

- (void)recoverStalePreludeIfNeeded
{
  NSUserDefaults *prefs = [self alarmDefaults];
  if (![prefs boolForKey:kKeyPreludeActive]) {
    return;
  }
  if ([self isScriptureMode:prefs]) {
    return;
  }
  NSTimeInterval started = [prefs doubleForKey:kKeyPreludeStartedAt];
  if (started <= 0) {
    return;
  }
}

- (BOOL)isReadingAlarmDueForAutoStart
{
  [self recoverStalePreludeIfNeeded];
  NSUserDefaults *prefs = [self alarmDefaults];
  if (![prefs boolForKey:kKeyEnabled]) {
    return NO;
  }
  if ([prefs boolForKey:kKeyPreludeActive]) {
    return NO;
  }
  if ([prefs boolForKey:kKeyPendingAutoPlay] && ![prefs boolForKey:kKeyDismissed]) {
    return NO;
  }

  NSCalendar *cal = [NSCalendar currentCalendar];
  NSDate *now = [NSDate date];
  NSDateComponents *nowComp = [cal components:(NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitWeekday)
                                     fromDate:now];
  if (![self isWeekdayEnabled:nowComp.weekday prefs:prefs]) {
    return NO;
  }

  NSInteger scheduledMinutes = [prefs integerForKey:kKeyHour] * 60 + [prefs integerForKey:kKeyMinute];
  NSInteger nowMinutes = nowComp.hour * 60 + nowComp.minute;
  NSInteger deltaMinutes = nowMinutes - scheduledMinutes;
  if (deltaMinutes < 0 || deltaMinutes > kAutoStartGraceMinutes) {
    return NO;
  }

  NSString *slot = [self currentAlarmSlotKey:prefs];
  NSString *lastHandled = [prefs stringForKey:kKeyLastHandledSlot];
  if (lastHandled.length > 0 && [lastHandled isEqualToString:slot]) {
    return NO;
  }
  if (![lastHandled isEqualToString:slot]) {
    [prefs setBool:NO forKey:kKeyDismissed];
  }
  return YES;
}

- (void)beginBackgroundPlaybackTask
{
  if (self.backgroundTaskId != UIBackgroundTaskInvalid) {
    return;
  }
  __weak typeof(self) weakSelf = self;
  self.backgroundTaskId =
      [[UIApplication sharedApplication] beginBackgroundTaskWithExpirationHandler:^{
        [weakSelf endBackgroundPlaybackTask];
      }];
}

- (void)endBackgroundPlaybackTask
{
  if (self.backgroundTaskId == UIBackgroundTaskInvalid) {
    return;
  }
  [[UIApplication sharedApplication] endBackgroundTask:self.backgroundTaskId];
  self.backgroundTaskId = UIBackgroundTaskInvalid;
}

- (void)cancelAutoContinueNotifications
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center removePendingNotificationRequestsWithIdentifiers:@[ kAutoContinueNotificationId, kHandoffNotificationId ]];
  [center removeDeliveredNotificationsWithIdentifiers:@[ kAutoContinueNotificationId, kHandoffNotificationId ]];
}

- (void)scheduleAutoContinueNotification
{
  [self cancelAutoContinueNotifications];
  NSUserDefaults *prefs = [self alarmDefaults];
  NSString *label = [prefs stringForKey:kKeyLabel];
  UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
  content.title = @"每日清晨闹钟";
  content.body = label.length > 0 ? label : @"预备音乐结束，开始今日读经。";
  content.sound = [UNNotificationSound defaultSound];
  content.userInfo = @{ @"kind" : @"reading-alarm-auto-continue" };

  UNTimeIntervalNotificationTrigger *trigger =
      [UNTimeIntervalNotificationTrigger triggerWithTimeInterval:kPreludeSeconds repeats:NO];
  UNNotificationRequest *request =
      [UNNotificationRequest requestWithIdentifier:kAutoContinueNotificationId content:content trigger:trigger];
  [[UNUserNotificationCenter currentNotificationCenter] addNotificationRequest:request withCompletionHandler:nil];
}

- (void)showScriptureHandoffNotification
{
  NSUserDefaults *prefs = [self alarmDefaults];
  NSString *label = [prefs stringForKey:kKeyLabel];
  UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
  content.title = @"每日清晨闹钟";
  content.body = label.length > 0 ? label : @"点击继续今日读经。";
  content.sound = [UNNotificationSound defaultSound];
  content.userInfo = @{ @"kind" : @"reading-alarm-auto-continue" };

  UNTimeIntervalNotificationTrigger *trigger =
      [UNTimeIntervalNotificationTrigger triggerWithTimeInterval:1 repeats:NO];
  UNNotificationRequest *request =
      [UNNotificationRequest requestWithIdentifier:kHandoffNotificationId content:content trigger:trigger];
  [[UNUserNotificationCenter currentNotificationCenter] addNotificationRequest:request withCompletionHandler:nil];
}

- (void)handleNotificationWake
{
  NSUserDefaults *prefs = [self alarmDefaults];
  if ([prefs boolForKey:kKeyDismissed]) {
    return;
  }
  if ([prefs boolForKey:kKeyPreludeActive]) {
    return;
  }
  if ([prefs boolForKey:kKeyPendingAutoPlay]) {
    return;
  }
  [self markCurrentSlotHandled];
  [self fireReadingReminderNowInternal];
}

- (void)addReadingReminderRequestWithIdentifier:(NSString *)identifier
                                        weekday:(NSInteger)weekday
                                           hour:(NSInteger)hour
                                         minute:(NSInteger)minute
                                          title:(NSString *)title
                                           body:(NSString *)body
                                         center:(UNUserNotificationCenter *)center
{
  UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
  content.title = title.length > 0 ? title : @"Daily morning alarm";
  content.body = body ?: @"";
  content.sound = [UNNotificationSound defaultSound];
  content.userInfo = @{ @"kind" : @"reading-reminder" };

  NSDateComponents *components = [[NSDateComponents alloc] init];
  components.hour = hour;
  components.minute = minute;
  if (weekday >= 1 && weekday <= 7) {
    components.weekday = weekday;
  }

  UNCalendarNotificationTrigger *trigger =
      [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:components repeats:YES];
  UNNotificationRequest *request =
      [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:trigger];
  [center addNotificationRequest:request
           withCompletionHandler:^(NSError *_Nullable error) {
             if (error) {
               NSLog(@"[AskBibleReadingAlarm] schedule failed (%@): %@", identifier, error);
             }
           }];
}

- (void)rescheduleReadingReminderNotifications:(NSDictionary *)dict
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getPendingNotificationRequestsWithCompletionHandler:^(
              NSArray<UNNotificationRequest *> *_Nonnull requests) {
    NSMutableArray<NSString *> *removeIds = [NSMutableArray array];
    for (UNNotificationRequest *request in requests) {
      if ([self isReadingReminderNotificationId:request.identifier]) {
        [removeIds addObject:request.identifier];
      }
    }
    if (removeIds.count > 0) {
      [center removePendingNotificationRequestsWithIdentifiers:removeIds];
    }

    if (![dict[@"enabled"] boolValue]) {
      return;
    }

    NSInteger hour = [dict[@"hour"] integerValue];
    NSInteger minute = [dict[@"minute"] integerValue];
    NSString *title = [dict[@"title"] isKindOfClass:[NSString class]] ? dict[@"title"] : @"Daily morning alarm";
    NSString *body = [dict[@"body"] isKindOfClass:[NSString class]] ? dict[@"body"] : @"";

    NSSet<NSNumber *> *weekdays = [self parseWeekdays:dict[@"weekdays"]];
    if (weekdays.count >= 7) {
      [self addReadingReminderRequestWithIdentifier:kReadingReminderNotificationId
                                            weekday:0
                                               hour:hour
                                             minute:minute
                                              title:title
                                               body:body
                                             center:center];
      return;
    }

    for (NSNumber *weekday in weekdays) {
      NSString *identifier =
          [NSString stringWithFormat:@"%@%@", kReadingReminderWeekdayIdPrefix, weekday];
      [self addReadingReminderRequestWithIdentifier:identifier
                                            weekday:weekday.integerValue
                                               hour:hour
                                             minute:minute
                                              title:title
                                               body:body
                                             center:center];
    }
  }];
}

RCT_EXPORT_METHOD(syncSchedule : (NSString *)json)
{
  NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
  if (!data) {
    return;
  }
  id payload = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![payload isKindOfClass:[NSDictionary class]]) {
    return;
  }
  NSDictionary *dict = (NSDictionary *)payload;
  NSUserDefaults *prefs = [self alarmDefaults];
  [prefs setBool:[dict[@"enabled"] boolValue] forKey:kKeyEnabled];
  [prefs setInteger:[dict[@"hour"] integerValue] forKey:kKeyHour];
  [prefs setInteger:[dict[@"minute"] integerValue] forKey:kKeyMinute];
  id weekdaysRaw = dict[@"weekdays"];
  if ([weekdaysRaw isKindOfClass:[NSArray class]]) {
    NSMutableArray<NSString *> *stored = [NSMutableArray array];
    for (id item in (NSArray *)weekdaysRaw) {
      NSInteger value = [item integerValue];
      if (value >= 1 && value <= 7) {
        [stored addObject:[NSString stringWithFormat:@"%ld", (long)value]];
      }
    }
    if (stored.count > 0) {
      [prefs setObject:stored forKey:kKeyWeekdays];
    } else {
      [prefs setObject:@[ @"1", @"2", @"3", @"4", @"5", @"6", @"7" ] forKey:kKeyWeekdays];
    }
  }
  [prefs setObject:dict[@"label"] ?: @"" forKey:kKeyLabel];
  [prefs setObject:dict[@"bookId"] ?: @"" forKey:kKeyBookId];
  [prefs setInteger:[dict[@"chapter"] integerValue] forKey:kKeyChapter];
  [prefs setObject:dict[@"bookName"] ?: @"" forKey:kKeyBookName];
  [prefs setObject:dict[@"translationId"] ?: @"cuv-simp" forKey:kKeyTranslationId];
  NSString *mode = [dict[@"mode"] isKindOfClass:[NSString class]] ? dict[@"mode"] : kModeScripture;
  [prefs setObject:[mode isEqualToString:kModeMusic] ? kModeMusic : kModeScripture forKey:kKeyMode];
  if (![dict[@"enabled"] boolValue]) {
    [self stopPreludeSessionMarkDismissed:YES];
  } else {
    [prefs setBool:NO forKey:kKeyDismissed];
  }
  [self rescheduleReadingReminderNotifications:dict];
}

RCT_EXPORT_METHOD(fireReadingReminderNow)
{
  [self markCurrentSlotHandled];
  [self fireReadingReminderNowInternal];
}

RCT_EXPORT_METHOD(maybeAutoStartDueAlarm : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  if (![self isReadingAlarmDueForAutoStart]) {
    resolve(@NO);
    return;
  }
  [self markCurrentSlotHandled];
  [self fireReadingReminderNowInternal];
  resolve(@YES);
}

- (void)fireReadingReminderNowInternal
{
  NSUserDefaults *prefs = [self alarmDefaults];
  [prefs setBool:NO forKey:kKeyDismissed];
  if ([self isScriptureMode:prefs]) {
    [self runScriptureHandoff];
    return;
  }
  [self startMusicPreludeInternal];
}

RCT_EXPORT_METHOD(peekTrigger : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  NSUserDefaults *prefs = [self alarmDefaults];
  BOOL pending = [prefs boolForKey:kKeyPendingAutoPlay];
  BOOL dismissed = [prefs boolForKey:kKeyDismissed];
  resolve(@(pending && !dismissed));
}

RCT_EXPORT_METHOD(isPreludeActive : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  [self recoverStalePreludeIfNeeded];
  resolve(@([[self alarmDefaults] boolForKey:kKeyPreludeActive]));
}

RCT_EXPORT_METHOD(getPreludeSecondsRemaining : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  [self recoverStalePreludeIfNeeded];
  NSUserDefaults *prefs = [self alarmDefaults];
  if (![prefs boolForKey:kKeyPreludeActive]) {
    resolve(@0);
    return;
  }
  NSTimeInterval started = [prefs doubleForKey:kKeyPreludeStartedAt];
  if (started <= 0) {
    resolve(@((NSInteger)kPreludeSeconds));
    return;
  }
  NSTimeInterval elapsed = [[NSDate date] timeIntervalSince1970] - started;
  NSInteger remaining = (NSInteger)ceil(kPreludeSeconds - elapsed);
  resolve(@(MAX(0, remaining)));
}

RCT_EXPORT_METHOD(getScheduledChapterTarget : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  NSUserDefaults *prefs = [self alarmDefaults];
  NSString *bookId = [[prefs stringForKey:kKeyBookId] stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
  if (bookId.length == 0) {
    resolve(nil);
    return;
  }
  resolve(@{
    @"bookId" : bookId,
    @"chapter" : @([prefs integerForKey:kKeyChapter]),
    @"bookName" : [prefs stringForKey:kKeyBookName] ?: @"",
    @"translationId" : [prefs stringForKey:kKeyTranslationId] ?: @"cuv-simp",
    @"label" : [prefs stringForKey:kKeyLabel] ?: @"",
  });
}

RCT_EXPORT_METHOD(getPendingReadingReminderIds : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getPendingNotificationRequestsWithCompletionHandler:^(
              NSArray<UNNotificationRequest *> *_Nonnull requests) {
    NSMutableArray<NSString *> *ids = [NSMutableArray array];
    for (UNNotificationRequest *request in requests) {
      if ([self isReadingReminderNotificationId:request.identifier]) {
        [ids addObject:request.identifier];
      }
    }
    resolve(ids);
  }];
}

RCT_EXPORT_METHOD(consumeTrigger : (RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
{
  NSUserDefaults *prefs = [self alarmDefaults];
  BOOL pending = [prefs boolForKey:kKeyPendingAutoPlay];
  BOOL dismissed = [prefs boolForKey:kKeyDismissed];
  if (!pending || dismissed) {
    resolve(@NO);
    return;
  }
  [prefs setBool:NO forKey:kKeyPendingAutoPlay];
  resolve(@YES);
}

RCT_EXPORT_METHOD(stopNativeAlertSound)
{
  [self stopPreludeSessionMarkDismissed:NO];
}

- (NSURL *)randomPreludeURL
{
  NSURL *docs = [[[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask] firstObject];
  if (docs) {
    NSURL *pool = [docs URLByAppendingPathComponent:@"reading-alarm-prelude-pool" isDirectory:YES];
    NSArray<NSString *> *names = [[NSFileManager defaultManager] contentsOfDirectoryAtPath:pool.path error:nil];
    NSMutableArray<NSURL *> *candidates = [NSMutableArray array];
    for (NSString *name in names) {
      if (![[name.pathExtension lowercaseString] isEqualToString:@"mp3"]) {
        continue;
      }
      NSURL *file = [pool URLByAppendingPathComponent:name];
      NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:file.path error:nil];
      if ([attrs fileSize] > 10000) {
        [candidates addObject:file];
      }
    }
    if (candidates.count > 0) {
      return candidates[arc4random_uniform((uint32_t)candidates.count)];
    }
  }
  return [[NSBundle mainBundle] URLForResource:@"reading_alarm_prelude" withExtension:@"mp3"];
}

RCT_EXPORT_METHOD(startPrelude)
{
  [self startMusicPreludeInternal];
}

- (void)startMusicPreludeInternal
{
  [self resetPreludeSession];
  NSUserDefaults *prefs = [self alarmDefaults];
  [prefs setBool:YES forKey:kKeyPreludeActive];
  [prefs setDouble:[[NSDate date] timeIntervalSince1970] forKey:kKeyPreludeStartedAt];
  [self beginBackgroundPlaybackTask];
  [self configureAudioSession];
  NSURL *url = [self randomPreludeURL];
  if (url) {
    NSError *error = nil;
    self.player = [[AVAudioPlayer alloc] initWithContentsOfURL:url error:&error];
    if (self.player && !error) {
      self.player.numberOfLoops = -1;
      self.player.volume = 1.0;
      [self.player prepareToPlay];
      [self.player play];
    }
  }
}

- (void)startPreludeInternal
{
  [self startMusicPreludeInternal];
}

RCT_EXPORT_METHOD(dismissAlarm)
{
  [self stopPreludeSessionMarkDismissed:YES];
  [self sendEventWithName:@"ReadingAlarmDismissed" body:nil];
}

- (void)onAppDidBecomeActive
{
  [self recoverStalePreludeIfNeeded];
  NSUserDefaults *prefs = [self alarmDefaults];
  if ([prefs boolForKey:kKeyPendingAutoPlay] && ![prefs boolForKey:kKeyDismissed]) {
    [self sendEventWithName:@"ReadingAlarmAutoContinue" body:nil];
    return;
  }
  if ([self isReadingAlarmDueForAutoStart]) {
    [self markCurrentSlotHandled];
    [self fireReadingReminderNowInternal];
  }
}

- (void)resetPreludeSession
{
  self.sessionContinued = NO;
  [self.autoContinueTimer invalidate];
  self.autoContinueTimer = nil;
}

- (void)runScriptureHandoff
{
  if (self.sessionContinued) {
    NSUserDefaults *prefs = [self alarmDefaults];
    if ([prefs boolForKey:kKeyPendingAutoPlay] && ![prefs boolForKey:kKeyDismissed]) {
      [self sendEventWithName:@"ReadingAlarmAutoContinue" body:nil];
    }
    return;
  }
  self.sessionContinued = YES;
  [self.autoContinueTimer invalidate];
  self.autoContinueTimer = nil;
  [self cancelAutoContinueNotifications];
  NSUserDefaults *prefs = [self alarmDefaults];
  [prefs setBool:YES forKey:kKeyPendingAutoPlay];
  [prefs setBool:NO forKey:kKeyPreludeActive];
  [prefs removeObjectForKey:kKeyPreludeStartedAt];
  [self.player stop];
  self.player = nil;
  [self endBackgroundPlaybackTask];

  UIApplicationState state = [UIApplication sharedApplication].applicationState;
  if (state != UIApplicationStateActive) {
    [self showScriptureHandoffNotification];
  }
  [self sendEventWithName:@"ReadingAlarmAutoContinue" body:nil];
}

- (void)runAutoContinue
{
  [self runScriptureHandoff];
}

- (void)stopPreludeSessionMarkDismissed:(BOOL)markDismissed
{
  [self.autoContinueTimer invalidate];
  self.autoContinueTimer = nil;
  [self cancelAutoContinueNotifications];
  NSUserDefaults *prefs = [self alarmDefaults];
  [prefs setBool:NO forKey:kKeyPreludeActive];
  [prefs removeObjectForKey:kKeyPreludeStartedAt];
  [self.player stop];
  self.player = nil;
  [self endBackgroundPlaybackTask];
  if (markDismissed) {
    [prefs setBool:NO forKey:kKeyPendingAutoPlay];
    [prefs setBool:YES forKey:kKeyDismissed];
    [self markCurrentSlotHandled];
  }
}

- (void)configureAudioSession
{
  AVAudioSession *session = [AVAudioSession sharedInstance];
  NSError *error = nil;
  [session setCategory:AVAudioSessionCategoryPlayback
                  mode:AVAudioSessionModeDefault
               options:AVAudioSessionCategoryOptionDuckOthers
                 error:&error];
  [session setActive:YES error:&error];
}

@end
