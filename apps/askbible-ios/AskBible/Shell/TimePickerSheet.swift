import SwiftUI

/// 选时间的小面板（每日读经提醒用）：羊皮卡片 + 系统滚轮，和其它弹层同一张底。
struct TimePickerSheet: View {
    let title: String
    @State private var date: Date
    let doneTitle: String
    var onDone: (_ hour: Int, _ minute: Int) -> Void
    var onCancel: () -> Void

    private let theme = Parchment.light

    init(title: String, hour: Int, minute: Int, doneTitle: String,
         onDone: @escaping (_ hour: Int, _ minute: Int) -> Void, onCancel: @escaping () -> Void) {
        self.title = title
        self.doneTitle = doneTitle
        self.onDone = onDone
        self.onCancel = onCancel
        var c = DateComponents(); c.hour = hour; c.minute = minute
        _date = State(initialValue: Calendar.current.date(from: c) ?? Date())
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            theme.modalBackdrop.ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture(perform: onCancel)

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text(title)
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(theme.ink)
                    Spacer()
                    Button(action: {
                        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
                        onDone(c.hour ?? 7, c.minute ?? 0)
                    }) {
                        Text(doneTitle)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(theme.ink)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                DatePicker("", selection: $date, displayedComponents: .hourAndMinute)
                    .datePickerStyle(.wheel)
                    .labelsHidden()
                    .frame(maxWidth: .infinity)
                    .padding(.top, 6)
            }
            .padding(.horizontal, 18).padding(.top, 16).padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
            .parchmentCard(cornerRadius: 16)
            .contentShape(Rectangle())
            .onTapGesture {}
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
