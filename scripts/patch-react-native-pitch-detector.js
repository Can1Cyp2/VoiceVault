const fs = require("fs");
const path = require("path");

const root = process.cwd();
const baseProcessorPath = path.join(
  root,
  "node_modules",
  "react-native-pitch-detector",
  "ios",
  "PitchDetector",
  "Processors",
  "BaseProcessor.swift"
);
const modulePath = path.join(
  root,
  "node_modules",
  "react-native-pitch-detector",
  "ios",
  "PitchDetector",
  "PitchDetectorModule.swift"
);

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function writeIfChanged(filePath, before, after) {
  if (before === after) {
    return false;
  }
  fs.writeFileSync(filePath, after);
  return true;
}

function patchBaseProcessor() {
  const before = readFile(baseProcessorPath);
  let source = before;

  if (!source.includes("import AVFAudio")) {
    source = source.replace("import Pitchy", "import Pitchy\nimport AVFAudio");
  }

  if (!source.includes("levelThreshold")) {
    source = source.replace(
      '        let algorithm = AlgorithmUtils.parse(for: config["algorithm"] as! String)\n',
      '        let algorithm = AlgorithmUtils.parse(for: config["algorithm"] as! String)\n' +
        '        let levelThreshold = (config["levelThreshold"] as? NSNumber)?.floatValue ?? -85.0\n'
    );
  }

  if (!source.includes("processor?.levelThreshold = levelThreshold")) {
    source = source.replace(
      "        processor = PitchEngine(config: pitchConfig, delegate: self)\n",
      "        processor = PitchEngine(config: pitchConfig, delegate: self)\n" +
        "        processor?.levelThreshold = levelThreshold\n"
    );
  }

  if (!source.includes("configureAudioSessionForPitchDetection")) {
    source = source.replace(
      "    func start(_ config: Dictionary<String, Any>) {",
      "    private func configureAudioSessionForPitchDetection() throws {\n" +
        "        let session = AVAudioSession.sharedInstance()\n" +
        "        try session.setCategory(.playAndRecord, mode: .measurement, options: [.defaultToSpeaker, .allowBluetooth])\n" +
        "        try session.setActive(true)\n" +
        "    }\n" +
        "    \n" +
        "    func start(_ config: Dictionary<String, Any>) {"
    );
  }

  if (!source.includes("PitchDetector audio session setup failed")) {
    source = source.replace(
      "        prepare(config)\n        \n        if ((processor?.active) != nil && !processor!.active) {",
      "        prepare(config)\n\n" +
        "        do {\n" +
        "            try configureAudioSessionForPitchDetection()\n" +
        "        } catch {\n" +
        '            print("PitchDetector audio session setup failed: \\(error)")\n' +
        "        }\n" +
        "        \n" +
        "        if ((processor?.active) != nil && !processor!.active) {"
    );
  }

  return writeIfChanged(baseProcessorPath, before, source);
}

function replaceMethod(source, methodName, replacement) {
  const marker = `    func ${methodName}`;
  const startIndex = source.indexOf(marker);
  if (startIndex === -1) {
    throw new Error(`Could not find ${methodName} in PitchDetectorModule.swift`);
  }

  let depth = 0;
  let bodyStarted = false;
  for (let index = startIndex; index < source.length; index++) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (char === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) {
        return source.slice(0, startIndex) + replacement + source.slice(index + 1);
      }
    }
  }

  throw new Error(`Could not parse ${methodName} in PitchDetectorModule.swift`);
}

function patchModule() {
  const before = readFile(modulePath);
  let source = before;

  const startReplacement =
    "    func start(_ config: Dictionary<String, Any>, resolve:@escaping RCTPromiseResolveBlock, reject:@escaping RCTPromiseRejectBlock) -> Void {\n" +
    "    let promise = PromiseUtils(resolve, reject)\n\n" +
    "    if (self.recording) {\n" +
    "        processor.stop()\n" +
    "        self.recording = false\n" +
    "    }\n\n" +
    "    processor.start(config)\n" +
    "    self.recording = true\n\n" +
    "    return promise.resolve(nil)\n" +
    "  }";

  const stopReplacement =
    "    func stop(resolve:@escaping RCTPromiseResolveBlock,reject:@escaping RCTPromiseRejectBlock) -> Void {\n" +
    "    let promise = PromiseUtils(resolve, reject)\n\n" +
    "    if (self.recording) {\n" +
    "        processor.stop()\n" +
    "        self.recording = false\n" +
    "    }\n\n" +
    "    return promise.resolve(nil)\n" +
    "  }";

  if (!source.includes("if (self.recording) {\n        processor.stop()")) {
    source = replaceMethod(source, "start", startReplacement);
  }

  if (source.includes('return promise.reject("Not recording")')) {
    source = replaceMethod(source, "stop", stopReplacement);
  }

  return writeIfChanged(modulePath, before, source);
}

try {
  const changedBase = patchBaseProcessor();
  const changedModule = patchModule();

  if (changedBase || changedModule) {
    console.log("Patched react-native-pitch-detector iOS audio session.");
  } else {
    console.log("react-native-pitch-detector iOS patch already applied.");
  }
} catch (error) {
  console.error("Failed to patch react-native-pitch-detector:", error);
  process.exit(1);
}
