import SwiftUI
import UIKit
import WidgetKit

struct TapNaEntry: TimelineEntry {
  let date: Date
  let name: String
  let title: String
  let company: String
  let qr: UIImage?
  let avatar: UIImage?
}

struct TapNaProvider: TimelineProvider {
  func placeholder(in context: Context) -> TapNaEntry {
    TapNaEntry(date: Date(), name: "Name", title: "Title", company: "Company", qr: nil, avatar: nil)
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
    let title = defaults?.string(forKey: "widget_title") ?? ""
    let company = defaults?.string(forKey: "widget_company") ?? ""
    return TapNaEntry(
      date: Date(),
      name: name.isEmpty ? "Tap Na" : name,
      title: title,
      company: company,
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
  static let shell = Color(red: 18 / 255, green: 18 / 255, blue: 18 / 255)
  static let panel = Color(red: 42 / 255, green: 42 / 255, blue: 42 / 255)
  static let muted = Color(red: 161 / 255, green: 161 / 255, blue: 170 / 255)
  static let faint = Color(red: 113 / 255, green: 113 / 255, blue: 122 / 255)
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
          .fill(Color.white.opacity(0.12))
          .overlay(
            Image(systemName: "qrcode")
              .font(.largeTitle)
              .foregroundColor(.white.opacity(0.45))
          )
      }
    }
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
  }
}

struct IdentityColumn: View {
  let entry: TapNaEntry
  var showPhoto: Bool

  var body: some View {
    VStack(spacing: 6) {
      if showPhoto, let avatar = entry.avatar {
        Image(uiImage: avatar)
          .resizable()
          .scaledToFill()
          .frame(width: 56, height: 56)
          .clipShape(Circle())
      } else if showPhoto {
        Circle().fill(Color(white: 0.25)).frame(width: 56, height: 56)
      }
      Text(entry.name)
        .font(.headline)
        .foregroundColor(.white)
        .lineLimit(1)
      if !entry.title.isEmpty {
        Text(entry.title)
          .font(.caption)
          .foregroundColor(TapNaPalette.muted)
          .lineLimit(1)
      }
      if !entry.company.isEmpty {
        Text(entry.company)
          .font(.caption)
          .foregroundColor(TapNaPalette.faint)
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity)
    .padding(10)
    .background(TapNaPalette.panel)
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
  }
}

extension View {
  @ViewBuilder
  func tapNaWidgetChrome() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) { TapNaPalette.shell }
    } else {
      background(TapNaPalette.shell)
    }
  }
}

struct TapNaQrView: View {
  var entry: TapNaEntry

  var body: some View {
    QrPlate(image: entry.qr)
      .padding(8)
      .tapNaWidgetChrome()
  }
}

struct TapNaCardView: View {
  var entry: TapNaEntry

  var body: some View {
    ViewThatFits(in: .vertical) {
      HStack(spacing: 8) {
        IdentityColumn(entry: entry, showPhoto: true)
        QrPlate(image: entry.qr)
      }
      HStack(spacing: 8) {
        IdentityColumn(entry: entry, showPhoto: false)
        QrPlate(image: entry.qr)
      }
      QrPlate(image: entry.qr)
    }
    .padding(8)
    .tapNaWidgetChrome()
  }
}

struct TapNaProfileView: View {
  var entry: TapNaEntry

  var body: some View {
    ViewThatFits(in: .vertical) {
      VStack(spacing: 10) {
        IdentityColumn(entry: entry, showPhoto: true)
        QrPlate(image: entry.qr)
      }
      VStack(spacing: 10) {
        IdentityColumn(entry: entry, showPhoto: false)
        QrPlate(image: entry.qr)
      }
      QrPlate(image: entry.qr)
    }
    .padding(10)
    .tapNaWidgetChrome()
  }
}

struct TapNaQrWidget: Widget {
  let kind: String = "TapNaQrWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TapNaProvider()) { entry in
      TapNaQrView(entry: entry)
    }
    .configurationDisplayName("Tap Na QR")
    .description("QR code only. People scan this to open your profile.")
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
    .description("Landscape business card with your details and QR code.")
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
    .description("Tall profile card with photo, details, and QR code.")
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
