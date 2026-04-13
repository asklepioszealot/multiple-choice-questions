import { describe, expect, it } from "vitest";
import {
  createRemoteWorkspaceSeed,
  detectSyncConflict,
} from "../../src/features/sync/conflict-resolution.js";

describe("sync conflict resolution", () => {
  it("does not flag a conflict when local data should seed an empty cloud workspace", () => {
    const localWorkspace = {
      loadedSets: {
        local: {
          id: "local",
          setName: "Local Set",
          fileName: "local.json",
          questions: [
            {
              q: "Soru?",
              options: ["A", "B"],
              correct: 0,
              explanation: "Aciklama",
              subject: "Genel",
            },
          ],
        },
      },
      selectedSetIds: ["local"],
    };

    const conflict = detectSyncConflict({
      localWorkspace,
      remoteRecords: [],
      localSnapshot: {
        selectedSetIds: ["local"],
        selectedAnswers: {},
        solutionVisible: {},
        session: null,
        autoAdvanceEnabled: false,
      },
      remoteSnapshot: null,
    });

    expect(conflict.hasConflict).toBe(false);
    expect(conflict.localSummary.setCount).toBe(1);
    expect(conflict.remoteSummary.setCount).toBe(0);
  });

  it("keeps diff metadata when local and remote workspaces have different files", () => {
    const conflict = detectSyncConflict({
      localWorkspace: {
        loadedSets: {
          local: {
            id: "local",
            setName: "Local Set",
            fileName: "local.json",
            updatedAt: "2026-04-04T10:00:00.000Z",
            questions: [
              {
                q: "Yerel soru?",
                options: ["A", "B"],
                correct: 0,
                explanation: "Aciklama",
                subject: "Genel",
              },
            ],
          },
        },
        selectedSetIds: ["local"],
      },
      remoteRecords: [
        {
          id: "cloud",
          setName: "Cloud Set",
          fileName: "cloud.json",
          updatedAt: "2026-04-04T09:00:00.000Z",
          questions: [
            {
              q: "Bulut soru?",
              options: ["A", "B"],
              correct: 1,
              explanation: "Aciklama",
              subject: "Genel",
            },
          ],
        },
      ],
      localSnapshot: null,
      remoteSnapshot: null,
    });

    expect(conflict.hasConflict).toBe(false);
    expect(conflict.setConflict).toBe(false);
    expect(conflict.studyConflict).toBe(false);
    expect(conflict.decisionEnvelope.recommendedAction).toBe("auto-merge");
    expect(conflict.decisionEnvelope.mergeableSets).toEqual([
      expect.objectContaining({
        matchKey: "file:cloud.json",
        reason: "remote-only",
        chosenSide: "remote",
      }),
      expect.objectContaining({
        matchKey: "file:local.json",
        reason: "local-only",
        chosenSide: "local",
      }),
    ]);
    expect(conflict.workspaceDiff.localOnly).toEqual([
      {
        id: "local",
        setName: "Local Set",
        updatedAt: "2026-04-04T10:00:00.000Z",
      },
    ]);
    expect(conflict.workspaceDiff.remoteOnly).toEqual([
      {
        id: "cloud",
        setName: "Cloud Set",
        updatedAt: "2026-04-04T09:00:00.000Z",
      },
    ]);
  });

  it("flags a study-state conflict even when the loaded sets match", () => {
    const remoteRecords = [
      {
        id: "demo",
        setName: "Demo",
        fileName: "demo.json",
        questions: [
          {
            q: "Soru?",
            options: ["A", "B"],
            correct: 0,
            explanation: "Aciklama",
            subject: "Genel",
          },
        ],
      },
    ];

    const remoteWorkspace = createRemoteWorkspaceSeed(remoteRecords, ["demo"]);
    const conflict = detectSyncConflict({
      localWorkspace: remoteWorkspace,
      remoteRecords,
      localSnapshot: {
        selectedSetIds: ["demo"],
        selectedAnswers: { "demo:0:Soru?": 0 },
        solutionVisible: {},
        session: null,
        autoAdvanceEnabled: false,
      },
      remoteSnapshot: {
        selectedSetIds: ["demo"],
        selectedAnswers: { "demo:0:Soru?": 1 },
        solutionVisible: {},
        session: null,
        autoAdvanceEnabled: false,
      },
    });

    expect(conflict.hasConflict).toBe(true);
    expect(conflict.setConflict).toBe(false);
    expect(conflict.studyConflict).toBe(true);
    expect(conflict.studyDiff.localAnsweredCount).toBe(1);
    expect(conflict.studyDiff.remoteAnsweredCount).toBe(1);
  });

  it("auto-merges a newer local version of the same matched set", () => {
    const conflict = detectSyncConflict({
      localWorkspace: {
        loadedSets: {
          demo: {
            id: "demo",
            setName: "Demo",
            fileName: "demo.md",
            updatedAt: "2026-04-04T12:00:00.000Z",
            questions: [
              {
                q: "Yerel soru?",
                options: ["A", "B"],
                correct: 0,
                explanation: "Aciklama",
                subject: "Genel",
              },
            ],
          },
        },
        selectedSetIds: ["demo"],
      },
      remoteRecords: [
        {
          id: "demo",
          setName: "Demo",
          fileName: "demo.md",
          updatedAt: "2026-04-04T11:00:00.000Z",
          questions: [
            {
              q: "Bulut soru?",
              options: ["A", "B"],
              correct: 0,
              explanation: "Aciklama",
              subject: "Genel",
            },
          ],
        },
      ],
      localSnapshot: null,
      remoteSnapshot: null,
    });

    expect(conflict.hasConflict).toBe(false);
    expect(conflict.setConflict).toBe(false);
    expect(conflict.decisionEnvelope.recommendedAction).toBe("auto-merge");
    expect(conflict.decisionEnvelope.mergeableSets).toEqual([
      expect.objectContaining({
        matchKey: "file:demo.md",
        reason: "local-newer",
        chosenSide: "local",
        setName: "Demo",
      }),
    ]);
    expect(conflict.decisionEnvelope.blockingConflicts).toEqual([]);
    expect(conflict.recordsToUpload).toEqual([
      expect.objectContaining({
        id: "demo",
        fileName: "demo.md",
      }),
    ]);
  });

  it("treats the same source path as the same logical set even when ids differ", () => {
    const conflict = detectSyncConflict({
      localWorkspace: {
        loadedSets: {
          "local-demo": {
            id: "local-demo",
            setName: "Kardiyoloji",
            fileName: "local-cardio.md",
            sourcePath: "C:/sets/cardio.md",
            sourceFormat: "markdown",
            updatedAt: "2026-04-04T10:00:00.000Z",
            questions: [
              {
                id: "q-1",
                q: "Soru?",
                options: ["A", "B"],
                correct: 0,
                explanation: "Aciklama",
                subject: "Genel",
              },
            ],
          },
        },
        selectedSetIds: ["local-demo"],
      },
      remoteRecords: [
        {
          id: "remote-demo",
          setName: "Kardiyoloji",
          fileName: "cloud-cardio.md",
          sourcePath: "C:/sets/cardio.md",
          sourceFormat: "markdown",
          updatedAt: "2026-04-04T11:00:00.000Z",
          questions: [
            {
              id: "q-1",
              q: "Soru?",
              options: ["A", "B"],
              correct: 0,
              explanation: "Aciklama",
              subject: "Genel",
            },
          ],
        },
      ],
      localSnapshot: {
        selectedSetIds: ["local-demo"],
        selectedAnswers: {
          "set:local-demo::id:q-1": 0,
        },
        solutionVisible: {},
        session: {
          currentQuestionIndex: 0,
          currentQuestionKey: "set:local-demo::id:q-1",
          selectedTopic: "Genel",
        },
        autoAdvanceEnabled: false,
        updatedAt: "2026-04-04T10:30:00.000Z",
      },
      remoteSnapshot: null,
    });

    expect(conflict.hasConflict).toBe(false);
    expect(Object.keys(conflict.mergedWorkspace.loadedSets)).toEqual(["remote-demo"]);
    expect(conflict.decisionEnvelope.mergeableSets).toEqual([
      expect.objectContaining({
        matchKey: "source:C:/sets/cardio.md",
        reason: "remote-newer",
        chosenSide: "remote",
      }),
    ]);
    expect(conflict.mergedSnapshot).toMatchObject({
      selectedSetIds: ["remote-demo"],
      selectedAnswers: {
        "set:remote-demo::id:q-1": 0,
      },
      session: {
        currentQuestionKey: "set:remote-demo::id:q-1",
      },
    });
    expect(conflict.decisionEnvelope.studyStateSummary).toEqual(
      expect.objectContaining({
        autoCarriedAnswerCount: 1,
        blockingAnswerCount: 0,
      }),
    );
  });

  it("marks replaced remote ids for cleanup when a newer local match wins", () => {
    const conflict = detectSyncConflict({
      localWorkspace: {
        loadedSets: {
          "local-demo": {
            id: "local-demo",
            setName: "Kardiyoloji",
            fileName: "local-cardio.md",
            sourcePath: "C:/sets/cardio.md",
            sourceFormat: "markdown",
            updatedAt: "2026-04-04T12:00:00.000Z",
            questions: [
              {
                id: "q-1",
                q: "Yerel soru?",
                options: ["A", "B"],
                correct: 0,
                explanation: "Aciklama",
                subject: "Genel",
              },
            ],
          },
        },
        selectedSetIds: ["local-demo"],
      },
      remoteRecords: [
        {
          id: "remote-demo",
          setName: "Kardiyoloji",
          fileName: "cloud-cardio.md",
          sourcePath: "C:/sets/cardio.md",
          sourceFormat: "markdown",
          updatedAt: "2026-04-04T11:00:00.000Z",
          questions: [
            {
              id: "q-1",
              q: "Eski soru?",
              options: ["A", "B"],
              correct: 1,
              explanation: "Aciklama",
              subject: "Genel",
            },
          ],
        },
      ],
      localSnapshot: null,
      remoteSnapshot: null,
    });

    expect(conflict.hasConflict).toBe(false);
    expect(conflict.recordsToUpload).toEqual([
      expect.objectContaining({
        id: "local-demo",
        sourcePath: "C:/sets/cardio.md",
      }),
    ]);
    expect(conflict.remoteIdsToDelete).toEqual(["remote-demo"]);
    expect(conflict.decisionEnvelope.mergeableSets).toEqual([
      expect.objectContaining({
        matchKey: "source:C:/sets/cardio.md",
        reason: "local-newer",
        chosenSide: "local",
      }),
    ]);
  });

  it("auto-merges disjoint file identities and marks local-only records for upload", () => {
    const conflict = detectSyncConflict({
      localWorkspace: {
        loadedSets: {
          local: {
            id: "local",
            setName: "Yerel Set",
            fileName: "local.md",
            sourceFormat: "markdown",
            updatedAt: "2026-04-04T10:00:00.000Z",
            questions: [
              {
                q: "Yerel soru?",
                options: ["A", "B"],
                correct: 0,
                explanation: "Aciklama",
                subject: "Genel",
              },
            ],
          },
        },
        selectedSetIds: ["local"],
      },
      remoteRecords: [
        {
          id: "remote",
          setName: "Bulut Set",
          fileName: "remote.md",
          sourceFormat: "markdown",
          updatedAt: "2026-04-04T11:00:00.000Z",
          questions: [
            {
              q: "Bulut soru?",
              options: ["A", "B"],
              correct: 1,
              explanation: "Aciklama",
              subject: "Genel",
            },
          ],
        },
      ],
      localSnapshot: {
        selectedSetIds: ["local"],
        selectedAnswers: {},
        solutionVisible: {},
        session: null,
        autoAdvanceEnabled: false,
        updatedAt: "2026-04-04T10:10:00.000Z",
      },
      remoteSnapshot: {
        selectedSetIds: ["remote"],
        selectedAnswers: {},
        solutionVisible: {},
        session: null,
        autoAdvanceEnabled: false,
        updatedAt: "2026-04-04T11:10:00.000Z",
      },
    });

    expect(conflict.hasConflict).toBe(false);
    expect(Object.keys(conflict.mergedWorkspace.loadedSets)).toEqual([
      "local",
      "remote",
    ]);
    expect(conflict.mergedSnapshot?.selectedSetIds).toEqual(["local", "remote"]);
    expect(conflict.recordsToUpload).toEqual([
      expect.objectContaining({
        id: "local",
        fileName: "local.md",
      }),
    ]);
  });

  it("blocks when the same matched set changed on both sides", () => {
    const conflict = detectSyncConflict({
      localWorkspace: {
        loadedSets: {
          "local-demo": {
            id: "local-demo",
            setName: "Kardiyoloji",
            fileName: "cardio.md",
            sourcePath: "C:/sets/cardio.md",
            sourceFormat: "markdown",
            updatedAt: "2026-04-04T10:00:00.000Z",
            questions: [
              {
                id: "q-1",
                q: "Yerel soru?",
                options: ["A", "B"],
                correct: 0,
                explanation: "Aciklama",
                subject: "Genel",
              },
            ],
          },
        },
        selectedSetIds: ["local-demo"],
      },
      remoteRecords: [
        {
          id: "remote-demo",
          setName: "Kardiyoloji",
          fileName: "cardio.md",
          sourcePath: "C:/sets/cardio.md",
          sourceFormat: "markdown",
          updatedAt: "2026-04-04T10:00:00.000Z",
          questions: [
            {
              id: "q-1",
              q: "Bulut soru?",
              options: ["A", "B"],
              correct: 1,
              explanation: "Aciklama",
              subject: "Genel",
            },
          ],
        },
      ],
      localSnapshot: {
        selectedSetIds: ["local-demo"],
        selectedAnswers: {
          "set:local-demo::id:q-1": 0,
        },
        solutionVisible: {},
        session: {
          currentQuestionIndex: 0,
          currentQuestionKey: "set:local-demo::id:q-1",
          selectedTopic: "Genel",
        },
        autoAdvanceEnabled: false,
        updatedAt: "2026-04-04T10:05:00.000Z",
      },
      remoteSnapshot: {
        selectedSetIds: ["remote-demo"],
        selectedAnswers: {
          "set:remote-demo::id:q-1": 1,
        },
        solutionVisible: {},
        session: {
          currentQuestionIndex: 0,
          currentQuestionKey: "set:remote-demo::id:q-1",
          selectedTopic: "Genel",
        },
        autoAdvanceEnabled: false,
        updatedAt: "2026-04-04T10:05:00.000Z",
      },
    });

    expect(conflict.hasConflict).toBe(true);
    expect(conflict.setConflict).toBe(true);
    expect(conflict.decisionEnvelope.recommendedAction).toBe("manual-resolution");
    expect(conflict.decisionEnvelope.mergeableSets).toEqual([]);
    expect(conflict.decisionEnvelope.blockingConflicts).toEqual([
      expect.objectContaining({
        matchKey: "source:C:/sets/cardio.md",
        newerSide: "equal",
        setName: "Kardiyoloji",
        questionDelta: 1,
        answerDelta: 1,
      }),
    ]);
  });
});
