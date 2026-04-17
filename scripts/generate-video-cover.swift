import AppKit
import AVFoundation
import CoreGraphics
import Foundation
import QuickLookThumbnailing

struct Options {
  var postsRoot: URL
  var specificPostSlug: String?
  var overwrite = false
  var sampleCount = 18
}

struct FrameAnalysis {
  let time: CMTime
  let timeSeconds: Double
  let normalizedTime: Double
  let luminanceMean: Double
  let luminanceStdDev: Double
  let saturationMean: Double
  let edgeMean: Double
  let clippingFraction: Double
  let luminanceSamples: [Double]
  var neighborDifference: Double = 0

  var score: Double {
    let exposureScore = 1 - min(abs(luminanceMean - 0.52) / 0.52, 1)
    let contrastScore = min(luminanceStdDev * 3.2, 1)
    let detailScore = min(edgeMean * 5.5, 1)
    let saturationScore = min(saturationMean * 2.0, 1)
    let stabilityScore = 1 - min(neighborDifference / 0.16, 1)
    let centerBias = 1 - abs(normalizedTime - 0.5) * 1.2
    let clippingPenalty = min(clippingFraction * 2.4, 1)

    return
      detailScore * 0.34 +
      contrastScore * 0.22 +
      exposureScore * 0.18 +
      saturationScore * 0.08 +
      stabilityScore * 0.12 +
      max(0, centerBias) * 0.06 -
      clippingPenalty * 0.18
  }
}

enum ScriptError: Error, CustomStringConvertible {
  case invalidArgument(String)
  case missingVideoFile(URL)
  case invalidVideoDuration(URL)
  case coverEncodingFailed(URL)
  case frameGenerationFailed(URL, String?)

  var description: String {
    switch self {
    case .invalidArgument(let message):
      return message
    case .missingVideoFile(let url):
      return "missing video file under \(url.path)"
    case .invalidVideoDuration(let url):
      return "invalid or empty video duration for \(url.path)"
    case .coverEncodingFailed(let url):
      return "failed to encode JPEG cover to \(url.path)"
    case .frameGenerationFailed(let url, let details):
      if let details, !details.isEmpty {
        return "failed to extract any candidate frames from \(url.path): \(details)"
      }
      return "failed to extract any candidate frames from \(url.path)"
    }
  }
}

private let fileManager = FileManager.default

func printUsage() {
  print(
    """
    Usage:
      swift scripts/generate-video-cover.swift [--post <slug>] [--overwrite] [--samples <count>] [--posts-root <path>]

    Examples:
      npm run cover:videos
      npm run cover:videos -- --post 2026-04-17-orange-cat-under-table-watch-mode
      npm run cover:videos -- --post 2026-04-17-orange-cat-under-table-watch-mode --overwrite
    """
  )
}

func parseOptions(arguments: [String]) throws -> Options {
  let cwd = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
  var options = Options(postsRoot: cwd.appendingPathComponent("local-post-assets/posts", isDirectory: true))

  var index = 0
  while index < arguments.count {
    let argument = arguments[index]

    switch argument {
    case "--post":
      index += 1
      guard index < arguments.count else {
        throw ScriptError.invalidArgument("--post requires a slug")
      }
      options.specificPostSlug = arguments[index]
    case "--posts-root":
      index += 1
      guard index < arguments.count else {
        throw ScriptError.invalidArgument("--posts-root requires a path")
      }
      let path = arguments[index]
      options.postsRoot = URL(fileURLWithPath: path, relativeTo: cwd).standardizedFileURL
    case "--overwrite":
      options.overwrite = true
    case "--samples":
      index += 1
      guard index < arguments.count, let parsed = Int(arguments[index]), parsed >= 6 else {
        throw ScriptError.invalidArgument("--samples requires an integer >= 6")
      }
      options.sampleCount = parsed
    case "--help", "-h":
      printUsage()
      Foundation.exit(0)
    default:
      throw ScriptError.invalidArgument("unknown argument: \(argument)")
    }

    index += 1
  }

  return options
}

func listPostDirectories(options: Options) throws -> [URL] {
  if let slug = options.specificPostSlug {
    return [options.postsRoot.appendingPathComponent(slug, isDirectory: true)]
  }

  let entries = try fileManager.contentsOfDirectory(
    at: options.postsRoot,
    includingPropertiesForKeys: [.isDirectoryKey],
    options: [.skipsHiddenFiles]
  )

  return entries
    .filter { $0.lastPathComponent != "_template" }
    .filter {
      (try? $0.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) ?? false
    }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
}

func resolveVideoURL(for postDirectory: URL) throws -> URL {
  let videosDirectory = postDirectory.appendingPathComponent("videos", isDirectory: true)
  let preferredNames = [
    "main.mp4",
    "main.mov",
    "main.m4v",
    "cover-source.mp4",
    "cover-source.mov",
  ]

  for fileName in preferredNames {
    let candidate = videosDirectory.appendingPathComponent(fileName)
    if fileManager.fileExists(atPath: candidate.path) {
      return candidate
    }
  }

  let discovered = (try? fileManager.contentsOfDirectory(
    at: videosDirectory,
    includingPropertiesForKeys: [.isRegularFileKey],
    options: [.skipsHiddenFiles]
  )) ?? []

  let allowedExtensions = Set(["mp4", "mov", "m4v"])
  if let fallback = discovered.first(where: {
    let isRegularFile = (try? $0.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) ?? false
    return isRegularFile && allowedExtensions.contains($0.pathExtension.lowercased())
  }) {
    return fallback
  }

  throw ScriptError.missingVideoFile(videosDirectory)
}

func buildSampleTimes(duration: Double, sampleCount: Int) -> [CMTime] {
  guard duration > 0 else { return [CMTime(seconds: 0, preferredTimescale: 600)] }

  let safeStart = min(max(duration * 0.12, 0.35), max(duration - 0.20, 0))
  let safeEnd = max(duration - max(duration * 0.12, 0.35), safeStart + 0.01)
  let actualSampleCount = max(sampleCount, 6)

  return (0..<actualSampleCount).map { index in
    let progress = (Double(index) + 0.5) / Double(actualSampleCount)
    let seconds = safeStart + ((safeEnd - safeStart) * progress)
    return CMTime(seconds: seconds, preferredTimescale: 600)
  }
}

func rasterizeImage(_ cgImage: CGImage, maxDimension: Int) -> (width: Int, height: Int, pixels: [UInt8])? {
  let width = cgImage.width
  let height = cgImage.height
  guard width > 0, height > 0 else { return nil }

  let scale = min(Double(maxDimension) / Double(width), Double(maxDimension) / Double(height))
  let targetWidth = max(1, Int((Double(width) * scale).rounded()))
  let targetHeight = max(1, Int((Double(height) * scale).rounded()))

  var pixels = Array(repeating: UInt8(0), count: targetWidth * targetHeight * 4)
  let colorSpace = CGColorSpaceCreateDeviceRGB()

  let succeeded = pixels.withUnsafeMutableBytes { rawBuffer -> Bool in
    guard let baseAddress = rawBuffer.baseAddress else {
      return false
    }

    guard let context = CGContext(
      data: baseAddress,
      width: targetWidth,
      height: targetHeight,
      bitsPerComponent: 8,
      bytesPerRow: targetWidth * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
      return false
    }

    context.interpolationQuality = .medium
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
    return true
  }

  guard succeeded else {
    return nil
  }

  return (targetWidth, targetHeight, pixels)
}

func analyzeFrame(_ cgImage: CGImage, time: CMTime, duration: Double) -> FrameAnalysis? {
  guard let rasterized = rasterizeImage(cgImage, maxDimension: 96) else {
    return nil
  }

  let width = rasterized.width
  let height = rasterized.height
  let buffer = rasterized.pixels

  var luminanceValues = Array(repeating: 0.0, count: width * height)
  var luminanceSum = 0.0
  var luminanceSquaredSum = 0.0
  var saturationSum = 0.0
  var clippingCount = 0.0

  for y in 0..<height {
    for x in 0..<width {
      let offset = (y * width + x) * 4
      let red = Double(buffer[offset]) / 255.0
      let green = Double(buffer[offset + 1]) / 255.0
      let blue = Double(buffer[offset + 2]) / 255.0

      let luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
      let maxChannel = max(red, max(green, blue))
      let minChannel = min(red, min(green, blue))
      let saturation = maxChannel == 0 ? 0 : (maxChannel - minChannel) / maxChannel

      let index = y * width + x
      luminanceValues[index] = luminance
      luminanceSum += luminance
      luminanceSquaredSum += luminance * luminance
      saturationSum += saturation

      if luminance <= 0.03 || luminance >= 0.97 {
        clippingCount += 1
      }
    }
  }

  let totalPixels = Double(width * height)
  let mean = luminanceSum / totalPixels
  let variance = max(0, (luminanceSquaredSum / totalPixels) - (mean * mean))
  let stdDev = sqrt(variance)

  var edgeAccumulator = 0.0
  var edgeSamples = 0.0
  if width > 1 && height > 1 {
    for y in 0..<(height - 1) {
      for x in 0..<(width - 1) {
        let index = y * width + x
        let horizontal = abs(luminanceValues[index] - luminanceValues[index + 1])
        let vertical = abs(luminanceValues[index] - luminanceValues[index + width])
        edgeAccumulator += horizontal + vertical
        edgeSamples += 2
      }
    }
  }

  let timeSeconds = CMTimeGetSeconds(time)
  return FrameAnalysis(
    time: time,
    timeSeconds: timeSeconds,
    normalizedTime: duration > 0 ? timeSeconds / duration : 0.5,
    luminanceMean: mean,
    luminanceStdDev: stdDev,
    saturationMean: saturationSum / totalPixels,
    edgeMean: edgeSamples > 0 ? edgeAccumulator / edgeSamples : 0,
    clippingFraction: clippingCount / totalPixels,
    luminanceSamples: luminanceValues
  )
}

func meanAbsoluteDifference(_ lhs: [Double], _ rhs: [Double]) -> Double {
  guard lhs.count == rhs.count, !lhs.isEmpty else { return 1 }
  var accumulator = 0.0
  for index in lhs.indices {
    accumulator += abs(lhs[index] - rhs[index])
  }
  return accumulator / Double(lhs.count)
}

func enrichNeighborDifferences(_ analyses: [FrameAnalysis]) -> [FrameAnalysis] {
  guard !analyses.isEmpty else { return analyses }
  var enriched = analyses

  for index in analyses.indices {
    let current = analyses[index]
    let previousDiff = index > 0 ? meanAbsoluteDifference(current.luminanceSamples, analyses[index - 1].luminanceSamples) : 0.04
    let nextDiff = index + 1 < analyses.count ? meanAbsoluteDifference(current.luminanceSamples, analyses[index + 1].luminanceSamples) : 0.04
    let averageDifference = (previousDiff + nextDiff) / 2
    enriched[index].neighborDifference = averageDifference
  }

  return enriched
}

func loadDurationSeconds(for asset: AVURLAsset, videoURL: URL) async throws -> Double {
  let duration = try await asset.load(.duration)
  let seconds = CMTimeGetSeconds(duration)
  guard seconds.isFinite, seconds > 0 else {
    throw ScriptError.invalidVideoDuration(videoURL)
  }
  return seconds
}

func generateCGImage(generator: AVAssetImageGenerator, at time: CMTime, videoURL: URL) async throws -> CGImage {
  try await withCheckedThrowingContinuation { continuation in
    generator.generateCGImageAsynchronously(for: time) { image, _, error in
      if let image {
        continuation.resume(returning: image)
        return
      }

      continuation.resume(throwing: error ?? ScriptError.frameGenerationFailed(videoURL, "image generation returned nil"))
    }
  }
}

func bestFrameTime(for videoURL: URL, sampleCount: Int) async throws -> (CMTime, Double) {
  let asset = AVURLAsset(url: videoURL)
  let duration = try await loadDurationSeconds(for: asset, videoURL: videoURL)

  let generator = AVAssetImageGenerator(asset: asset)
  generator.appliesPreferredTrackTransform = true
  generator.maximumSize = CGSize(width: 240, height: 240)
  generator.requestedTimeToleranceBefore = CMTime(seconds: 0.35, preferredTimescale: 600)
  generator.requestedTimeToleranceAfter = CMTime(seconds: 0.35, preferredTimescale: 600)

  let times = buildSampleTimes(duration: duration, sampleCount: sampleCount)
  var analyses: [FrameAnalysis] = []
  var extractionErrors: [String] = []

  for time in times {
    do {
      let image = try await generateCGImage(generator: generator, at: time, videoURL: videoURL)
      if let analysis = analyzeFrame(image, time: time, duration: duration) {
        analyses.append(analysis)
      } else {
        extractionErrors.append("analysis returned nil at \(String(format: "%.2f", CMTimeGetSeconds(time)))s")
      }
    } catch {
      extractionErrors.append(error.localizedDescription)
      continue
    }
  }

  guard !analyses.isEmpty else {
    let uniqueErrors = Array(NSOrderedSet(array: extractionErrors).compactMap { $0 as? String })
    throw ScriptError.frameGenerationFailed(videoURL, uniqueErrors.prefix(3).joined(separator: " | "))
  }

  let scored = enrichNeighborDifferences(analyses)
  let best = scored.max { lhs, rhs in
    if lhs.score == rhs.score {
      return lhs.edgeMean < rhs.edgeMean
    }
    return lhs.score < rhs.score
  }!

  return (best.time, best.score)
}

func writeJPEG(_ cgImage: CGImage, to outputURL: URL) throws {
  let bitmap = NSBitmapImageRep(cgImage: cgImage)
  guard let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.88]) else {
    throw ScriptError.coverEncodingFailed(outputURL)
  }

  try fileManager.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true, attributes: nil)
  try data.write(to: outputURL)
}

func generateQuickLookImage(for videoURL: URL, maxDimension: CGFloat = 1600) throws -> CGImage {
  let request = QLThumbnailGenerator.Request(
    fileAt: videoURL,
    size: CGSize(width: maxDimension, height: maxDimension),
    scale: 1,
    representationTypes: .all
  )

  let semaphore = DispatchSemaphore(value: 0)
  var generatedImage: CGImage?
  var generatedError: Error?

  QLThumbnailGenerator.shared.generateBestRepresentation(for: request) { thumbnail, error in
    generatedImage = thumbnail?.cgImage
    generatedError = error
    semaphore.signal()
  }

  semaphore.wait()

  if let generatedImage {
    return generatedImage
  }

  throw generatedError ?? ScriptError.frameGenerationFailed(videoURL, "Quick Look thumbnail generation failed")
}

func generateCover(videoURL: URL, outputURL: URL, sampleCount: Int, overwrite: Bool) async throws -> String {
  if fileManager.fileExists(atPath: outputURL.path), !overwrite {
    return "skip  \(outputURL.path) (exists, use --overwrite to replace)"
  }

  do {
    let (bestTime, score) = try await bestFrameTime(for: videoURL, sampleCount: sampleCount)

    let asset = AVURLAsset(url: videoURL)
    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.maximumSize = CGSize(width: 1600, height: 1600)
    generator.requestedTimeToleranceBefore = CMTime(seconds: 0.35, preferredTimescale: 600)
    generator.requestedTimeToleranceAfter = CMTime(seconds: 0.35, preferredTimescale: 600)

    let image = try await generateCGImage(generator: generator, at: bestTime, videoURL: videoURL)
    try writeJPEG(image, to: outputURL)

    let seconds = String(format: "%.2f", CMTimeGetSeconds(bestTime))
    let scoreLabel = String(format: "%.3f", score)
    return "write \(outputURL.path) <= \(videoURL.lastPathComponent) @ \(seconds)s score=\(scoreLabel)"
  } catch {
    let image = try generateQuickLookImage(for: videoURL)
    try writeJPEG(image, to: outputURL)
    return "write \(outputURL.path) <= \(videoURL.lastPathComponent) via QuickLook fallback"
  }
}

@main
struct GenerateVideoCoverScript {
  static func main() async {
    do {
      let options = try parseOptions(arguments: Array(CommandLine.arguments.dropFirst()))
      let postDirectories = try listPostDirectories(options: options)

      if postDirectories.isEmpty {
        print("No post directories found under \(options.postsRoot.path)")
        Foundation.exit(0)
      }

      var discoveredVideos = 0
      for postDirectory in postDirectories {
        let videoURL: URL
        do {
          videoURL = try resolveVideoURL(for: postDirectory)
          discoveredVideos += 1
        } catch ScriptError.missingVideoFile {
          continue
        }

        let outputURL = postDirectory
          .appendingPathComponent("images", isDirectory: true)
          .appendingPathComponent("cover.jpg")

        let result = try await generateCover(
          videoURL: videoURL,
          outputURL: outputURL,
          sampleCount: options.sampleCount,
          overwrite: options.overwrite
        )
        print(result)
      }

      if discoveredVideos == 0 {
        print("No source videos found under \(options.postsRoot.path)")
      }
    } catch let error as ScriptError {
      fputs("error: \(error)\n", stderr)
      Foundation.exit(1)
    } catch {
      fputs("error: \(error.localizedDescription)\n", stderr)
      Foundation.exit(1)
    }
  }
}
