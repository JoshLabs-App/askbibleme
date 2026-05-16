/** 祷告首页首屏：与读经页共用羊皮卷与版式变量 */
export function PrayerHomeFirstScreen() {
  return (
    <div className="relative">
      <header className="relative max-w-prose pt-1">
        <h1 className="prayer-heading">祷告与经文</h1>
        <p className="prayer-muted mt-4 text-[0.92em] font-medium leading-snug">让经文成为你与神的对话</p>
      </header>

      <blockquote className="prayer-accent-l mt-8 max-w-prose">
        <p className="prayer-eyebrow mb-2">如何祷告</p>
        <p className="prayer-body m-0">
          祷告不只是向神说话，
          <br />
          也是用祂的话来回应祂。
        </p>
      </blockquote>

      <div className="prayer-rule-b mt-10 sm:mt-12" aria-hidden />
    </div>
  );
}
