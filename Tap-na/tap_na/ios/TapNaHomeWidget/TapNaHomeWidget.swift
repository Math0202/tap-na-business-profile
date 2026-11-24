import SwiftUI
import UIKit
import WidgetKit

struct TapNaEntry: TimelineEntry {
  let date: Date
  let name: String
  let theme: String
  let qr: UIImage?
  let avatar: UIImage?
}

struct TapNaProvider: TimelineProvider {
  func placeholder(in context: Context) -> TapNaEntry {
    TapNaEntry(date: Date(), name: "Tap Na", theme: "dark", qr: nil, avatar: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (TapNaEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TapNaEntry>) -> Void) {
    completion(Timeline(entries: [loadEntry()], policy: .after(Date().addingTimeInterval(60 * 30))))
  }

  private func loadEntry() -> TapNaEntry {
    let defaults = UserDefaults(suiteName: "group.tapna.app")
    let name = defaults?.string(forKey: "widget_name") ?? "Tap Na"
    let theme = defaults?.string(forKey: "widget_theme") ?? "dark"
    return TapNaEntry(
      date: Date(),
      name: name.isEmpty ? "Tap Na" : name,
      theme: theme,
      qr: image(named: "widget_qr", defaults: defaults),
      avatar: image(named: "widget_avatar", defaults: defaults)
    )
  }

  private func image(named key: String, defaults: UserDefaults?) -> UIImage? {
    if let path = defaults?.string(forKey: key), !path.isEmpty, let image = UIImage(contentsOfFile: path) {
      return image
    }
    if let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.tapna.app") {
      return UIImage(contentsOfFile: group.appendingPathComponent(key).path)
    }
    return nil
  }
}

struct TapNaPalette {
  static let shellDark = Color(red: 18 / 255, green: 18 / 255, blue: 18 / 255)
  static let shellLight = Color(red: 244 / 255, green: 241 / 255, blue: 234 / 255)

  static func shell(theme: String, colorScheme: ColorScheme) -> Color {
    if theme == "light" { return shellLight }
    if theme == "dark" { return shellDark }
    return colorScheme == .dark ? shellDark : shellLight
  }
}

struct QrPlate: View {
  let image: UIImage?

  var body: some View {
    Group {
      if let image {
        Image(uiImage: image)
          .resizable()
          .scaledToFit()
      } else {
        RoundedRectangle(cornerRadius: 16)
          .fill(Color.white.opacity(0.92))
          .overlay(
            Image(systemName: "qrcode")
              .font(.largeTitle)
              .foregroundColor(.black.opacity(0.45))
          )
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
  }
}

struct AvatarBadge: View {
  let image: UIImage?

  var body: some View {
    Group {
      if let image {
        Image(uiImage: image)
          .resizable()
          .scaledToFit()
      } else {
        Circle()
          .fill(Color(white: 0.25))
      }
    }
    .clipShape(Circle())
    .overlay(Circle().stroke(Color.white, lineWidth: 3))
  }
}

extension View {
  @ViewBuilder
  func tapNaWidgetChrome(theme: String, colorScheme: ColorScheme) -> some View {
    let shell = TapNaPalette.shell(theme: theme, colorScheme: colorScheme)
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { shell }
    } else {
      background(shell)
    }
  }
}

struct TapNaQrView: View {
  @Environment(\.colorScheme) private var colorScheme
  var entry: TapNaEntry

  var body: some View {
    ZStack(alignment: .bottomTrailing) {
      QrPlate(image: entry.qr)
      if let avatar = entry.avatar {
        AvatarBadge(image: avatar)
          .frame(width: 34, height: 34)
          .padding(6)
      }
    }
    .padding(8)
    .tapNaWidgetChrome(theme: entry.theme, colorScheme: colorScheme)
  }
}

struct TapNaCardView: View {
  @Environment(\.colorScheme) private var colorScheme
  var entry: TapNaEntry

  var body: some View {
    HStack(spacing: 8) {
      if let avatar = entry.avatar {
        AvatarBadge(image: avatar)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .layoutPriority(-1)
      }
      QrPlate(image: entry.qr)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .padding(8)
    .tapNaWidgetChrome(theme: entry.theme, colorScheme: colorScheme)
  }
}

struct TapNaProfileView: View {
  @Environment(\.colorScheme) private var colorScheme
  var entry: TapNaEntry

  var body: some View {
    VStack(spacing: 10) {
      if let avatar = entry.avatar {
        AvatarBadge(image: avatar)
          .frame(width: 72, height: 72)
      }
      QrPlate(image: entry.qr)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .padding(10)
    .tapNaWidgetChrome(theme: entry.theme, colorScheme: colorScheme)
  }
}

struct TapNaQrWidget: Widget {
  let kind: String = "TapNaQrWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TapNaProvider()) { entry in
      TapNaQrView(entry: entry)
    }
    .configurationDisplayName("Tap Na QR")
    .description("QR code with your profile photo.")
    .supportedFamilies([.systemSmall])
  }
}

struct TapNaCardWidget: Widget {
  let kind: String = "TapNaCardWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TapNaProvider()) { entry in
      TapNaCardView(entry: entry)
    }
    .configurationDisplayName("Tap Na Card")
    .description("Wide QR with your profile photo.")
    .supportedFamilies([.systemMedium])
  }
}

struct TapNaProfileWidget: Widget {
  let kind: String = "TapNaProfileWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TapNaProvider()) { entry in
      TapNaProfileView(entry: entry)
    }
    .configurationDisplayName("Tap Na Profile")
    .description("Tall QR with your profile photo.")
    .supportedFamilies([.systemLarge])
  }
}

@main
struct TapNaWidgets: WidgetBundle {
  var body: some Widget {
    TapNaQrWidget()
    TapNaCardWidget()
    TapNaProfileWidget()
  }
}

#Preview("Tap Na QR", as: .systemSmall) {
  TapNaQrWidget()
}

#Preview("Tap Na Card", as: .systemMedium) {
  TapNaCardWidget()
}

#Preview("Tap Na Profile", as: .systemLarge) {
  TapNaProfileWidget()
}
