import SwiftUI
import UIKit
import WidgetKit

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> TapNaEntry {
    TapNaEntry(date: Date(), name: "Tap Na", title: "", company: "", qr: nil, avatar: nil)
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
    guard let path = defaults?.string(forKey: key), !path.isEmpty else {
      if let group = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.tapna.app") {
        let file = group.appendingPathComponent(key)
        return UIImage(contentsOfFile: file.path)
      }
      return nil
    }
    return UIImage(contentsOfFile: path)
  }
}

struct TapNaEntry: TimelineEntry {
  let date: Date
  let name: String
  let title: String
  let company: String
  let qr: UIImage?
  let avatar: UIImage?
}

struct TapNaHomeWidgetEntryView: View {
  var entry: Provider.Entry
  @Environment(\.widgetFamily) var family

  var body: some View {
    Group {
      switch family {
      case .systemSmall:
        qrView
      case .systemMedium:
        HStack(spacing: 12) {
          avatarView
          qrView
        }
      default:
        VStack(spacing: 8) {
          avatarView
          Text(entry.name)
            .font(.headline)
            .foregroundColor(.white)
            .lineLimit(1)
          if !entry.title.isEmpty {
            Text(entry.title)
              .font(.caption)
              .foregroundColor(Color(red: 0.37, green: 0.87, blue: 0.76))
              .lineLimit(1)
          }
          if !entry.company.isEmpty {
            Text(entry.company)
              .font(.caption)
              .foregroundColor(.white.opacity(0.7))
              .lineLimit(1)
          }
          qrView
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(8)
    .containerBackground(for: .widget) {
      Color.black
    }
  }

  private var qrView: some View {
    Group {
      if let qr = entry.qr {
        Image(uiImage: qr)
          .resizable()
          .scaledToFit()
      } else {
        Color.white
      }
    }
  }

  private var avatarView: some View {
    Group {
      if let avatar = entry.avatar {
        Image(uiImage: avatar)
          .resizable()
          .scaledToFill()
          .frame(width: 52, height: 52)
          .clipShape(Circle())
      }
    }
  }
}

@main
struct TapNaHomeWidget: Widget {
  let kind: String = "TapNaHomeWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      TapNaHomeWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Tap Na")
    .description("QR code for your Tap Na profile.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
