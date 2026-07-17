import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = AnalysisViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    intro
                    inputCard
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .foregroundStyle(.red)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
                    }
                    if let result = viewModel.result {
                        ResultView(result: result)
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("ShinraiCheck")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SOURCE-TRANSPARENT FACT CHECK")
                .font(.caption.bold())
                .foregroundStyle(.green)
            Text("情報の信頼性を、理由と全ソース付きで確認")
                .font(.title2.bold())
            Text("媒体の信頼度、主張との一致、独立した複数媒体の一致、反証情報を比較します。")
                .foregroundStyle(.secondary)
        }
    }

    private var inputCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("確認したい情報").font(.headline)
            TextEditor(text: $viewModel.claim)
                .frame(minHeight: 120)
                .padding(8)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
                .onChange(of: viewModel.claim) { _, newValue in
                    if newValue.count > 500 { viewModel.claim = String(newValue.prefix(500)) }
                }
            HStack {
                Text("\(viewModel.claim.count) / 500文字")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    Task { await viewModel.analyze() }
                } label: {
                    if viewModel.isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Text("信頼性を確認").bold()
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(!viewModel.canSubmit)
            }
        }
        .padding()
        .background(.background, in: RoundedRectangle(cornerRadius: 18))
    }
}

private struct ResultView: View {
    let result: AnalysisResponse

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            scoreCard
            reasonsCard
            breakdownCard
            warningsCard
            Text("使用したソース（全\(result.sources.count)件）")
                .font(.title3.bold())
            ForEach(result.sources) { source in
                SourceView(source: source)
            }
        }
    }

    private var scoreCard: some View {
        HStack(spacing: 18) {
            ZStack {
                Circle().stroke(.green.opacity(0.18), lineWidth: 10)
                Circle()
                    .trim(from: 0, to: CGFloat(result.probability) / 100)
                    .stroke(.green, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 1) {
                    Text("\(result.probability)%").font(.title2.bold())
                    Text("推定").font(.caption2).foregroundStyle(.secondary)
                }
            }
            .frame(width: 106, height: 106)

            VStack(alignment: .leading, spacing: 7) {
                Text("判定").font(.caption.bold()).foregroundStyle(.green)
                Text(result.verdict.label).font(.title3.bold())
                Text(result.claim).font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.background, in: RoundedRectangle(cornerRadius: 18))
    }

    private var reasonsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("なぜこの判定なのか").font(.headline)
            ForEach(Array(result.reasons.enumerated()), id: \.offset) { index, reason in
                HStack(alignment: .top) {
                    Text("\(index + 1).").bold()
                    Text(reason)
                }
            }
        }
        .cardStyle()
    }

    private var breakdownCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("点数の内訳").font(.headline)
            metric("支持証拠", result.breakdown.supportingEvidence)
            metric("反証証拠", result.breakdown.contradictingEvidence)
            metric("独立媒体の一致", result.breakdown.independentCorroboration)
            metric("平均ソース品質", result.breakdown.sourceQuality)
            metric("不確実性ペナルティ", result.breakdown.uncertaintyPenalty)
        }
        .cardStyle()
    }

    private func metric(_ name: String, _ value: Double) -> some View {
        HStack { Text(name).foregroundStyle(.secondary); Spacer(); Text(value, format: .number.precision(.fractionLength(3))).monospacedDigit().bold() }
    }

    private var warningsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("判定上の注意").font(.headline)
            ForEach(result.warnings, id: \.self) { Text("• \($0)").font(.footnote) }
        }
        .padding()
        .background(.yellow.opacity(0.10), in: RoundedRectangle(cornerRadius: 18))
    }
}

private struct SourceView: View {
    let source: EvidenceSource

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(source.stance.label)
                    .font(.caption.bold())
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(stanceColor.opacity(0.13), in: Capsule())
                    .foregroundStyle(stanceColor)
                Spacer()
                Text(source.category).font(.caption).foregroundStyle(.secondary)
            }
            Text(source.title).font(.headline)
            Text(source.domain).font(.caption).foregroundStyle(.secondary)
            if !source.description.isEmpty { Text(source.description).font(.subheadline) }
            HStack {
                metric("媒体", source.reputation)
                metric("関連", source.relevance)
                metric("寄与", source.contribution)
            }
            ForEach(source.reasons, id: \.self) { Text("• \($0)").font(.caption).foregroundStyle(.secondary) }
            if let url = URL(string: source.url) {
                Link("原文を開く", destination: url).font(.subheadline.bold())
            }
        }
        .cardStyle()
    }

    private var stanceColor: Color {
        switch source.stance {
        case .support: .green
        case .contradict: .red
        case .neutral: .gray
        }
    }

    private func metric(_ label: String, _ value: Double) -> some View {
        VStack { Text(label).font(.caption2).foregroundStyle(.secondary); Text("\(Int((value * 100).rounded()))").font(.caption.bold()) }
            .frame(maxWidth: .infinity).padding(7)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
    }
}

private extension View {
    func cardStyle() -> some View {
        self.padding().background(.background, in: RoundedRectangle(cornerRadius: 18))
    }
}
