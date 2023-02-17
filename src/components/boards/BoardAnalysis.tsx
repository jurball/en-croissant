import {
  Accordion,
  Box,
  Button,
  Flex,
  ScrollArea,
  Stack,
  Tabs
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  useForceUpdate,
  useHotkeys,
  useLocalStorage,
  useSessionStorage,
  useToggle,
  useViewportSize
} from "@mantine/hooks";
import {
  IconDatabase,
  IconInfoCircle,
  IconNotes,
  IconZoomCheck
} from "@tabler/icons";
import { Chess, DEFAULT_POSITION, Square, validateFen } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import { goToPosition, parsePGN, VariationTree } from "../../utils/chess";
import { CompleteGame, defaultGame } from "../../utils/db";
import { Engine } from "../../utils/engines";
import GameInfo from "../common/GameInfo";
import MoveControls from "../common/MoveControls";
import TreeContext from "../common/TreeContext";
import BestMoves from "../panels/analysis/BestMoves";
import EngineSettingsBoard from "../panels/analysis/EngineSettingsBoard";
import ReportModal from "../panels/analysis/ReportModal";
import AnnotationPanel from "../panels/annotation/AnnotationPanel";
import FenInput from "../panels/info/FenInput";
import PgnInput from "../panels/info/PgnInput";
import DatabasePanel from "../tabs/DatabasePanel";
import BoardPlay from "./BoardPlay";
import EvalBar from "./EvalBar";
import GameNotation from "./GameNotation";

function BoardAnalysis({ id }: { id: string }) {
  const [completeGame, setCompleteGame] = useSessionStorage<CompleteGame>({
    key: id,
    defaultValue: { game: defaultGame(), currentMove: [] },
  });
  const game = completeGame.game;

  const forceUpdate = useForceUpdate();
  const [editingMode, toggleEditingMode] = useToggle();
  const [reportingMode, toggleReportingMode] = useToggle();
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedEngines, setSelectedEngines] = useLocalStorage<Engine[]>({
    key: "selected-engines",
    defaultValue: [],
  });
  const form = useForm({
    initialValues: {
      fen: DEFAULT_POSITION,
    },
    validate: {
      fen: (value) => {
        const v = validateFen(value);
        if (v.valid) {
          return null;
        } else {
          return v.error;
        }
      },
    },
  });

  const initial_tree = useMemo(() => {
    const storedTree = sessionStorage.getItem(id + "-tree");
    if (storedTree) {
      const { pgn, currentMove } = JSON.parse(storedTree);
      if (pgn !== "") {
        const tree = parsePGN(pgn);
        const treeAtPosition = goToPosition(tree, currentMove);
        return treeAtPosition;
      }
    }
    const tree = parsePGN(game.moves);
    return tree;
  }, [game.moves]);

  // Variation tree of all the previous moves
  const [tree, setTree] = useSessionStorage<VariationTree>({
    key: id + "-tree",
    defaultValue: initial_tree,
    serialize: (value) => {
      const storedTree = JSON.stringify({
        pgn: value.getTopVariation().getPGN(),
        currentMove: value.getPosition(),
      });
      return storedTree;
    },
    deserialize: (value) => {
      const { pgn, currentMove } = JSON.parse(value);
      const tree = parsePGN(pgn);
      const treeAtPosition = goToPosition(tree, currentMove);
      return treeAtPosition;
    },
  });
  useEffect(() => {
    setTree(initial_tree);
  }, [initial_tree]);
  const [arrows, setArrows] = useState<string[]>([]);
  const chess = new Chess(tree.fen);

  function makeMove(move: { from: Square; to: Square; promotion?: string }) {
    if (editingMode) {
      const piece = chess.get(move.from);
      chess.remove(move.to);
      chess.remove(move.from);
      chess.put(piece, move.to);
      const newTree = new VariationTree(null, chess.fen(), null);
      setTree(newTree);
    } else {
      const newMove = chess.move(move);
      const newTree = new VariationTree(tree, chess.fen(), newMove);
      if (tree.children.length === 0) {
        tree.children = [newTree];
        setTree(newTree);
      } else if (tree.children.every((child) => child.fen !== chess.fen())) {
        tree.children.push(newTree);
        setTree(newTree);
      } else {
        const child = tree.children.find((child) => child.fen === chess.fen());
        setTree(child!);
      }
    }
  }

  function makeMoves(moves: string[]) {
    let parentTree = tree;
    let newTree = tree;
    moves.forEach((move) => {
      const newMove = chess.move(move, { sloppy: true });
      newTree = new VariationTree(parentTree, chess.fen(), newMove);
      if (parentTree.children.length === 0) {
        parentTree.children = [newTree];
        parentTree = newTree;
      } else if (
        parentTree.children.every((child) => child.fen !== newTree.fen)
      ) {
        parentTree.children.push(newTree);
        parentTree = newTree;
      } else {
        parentTree = parentTree.children.find(
          (child) => child.fen === newTree.fen
        )!;
      }
    });
    setTree(newTree);
  }

  function undoMove() {
    if (tree.parent) {
      setTree(tree.parent);
    }
  }

  function redoMove() {
    if (tree.children.length > 0) {
      setTree(tree.children[0]);
    }
  }

  function goToStart() {
    setTree(tree.getTopVariation());
  }

  function goToEnd() {
    setTree(tree.getBottomVariation());
  }

  function resetToFen(fen: string) {
    setTree(new VariationTree(null, fen, null));
  }

  useHotkeys([
    ["ArrowLeft", () => undoMove()],
    ["ArrowRight", () => redoMove()],
    ["ArrowUp", () => goToStart()],
    ["ArrowDown", () => goToEnd()],
  ]);

  useEffect(() => {
    setArrows([]);
  }, [tree.fen]);

  const { height, width } = useViewportSize();

  function getBoardSize(height: number, width: number) {
    const initial = Math.min((height - 140) * 0.95, width * 0.4);
    if (width < 680) {
      return width - 120;
    }
    return initial;
  }
  const boardSize = getBoardSize(height, width);

  return (
    <TreeContext.Provider value={tree}>
      <ReportModal
        moves={tree.getTopVariation().getPGN(false, false, false)}
        reportingMode={reportingMode}
        toggleReportingMode={toggleReportingMode}
        setLoading={setAnalysisLoading}
        setTree={setTree}
      />
      <Flex gap="md" wrap="wrap" align="start">
        {width > 800 && <EvalBar score={tree.score} boardSize={boardSize} />}
        <Box mx="auto">
          <BoardPlay
            makeMove={makeMove}
            arrows={arrows}
            editingMode={editingMode}
            toggleEditingMode={toggleEditingMode}
            setCompleteGame={setCompleteGame}
            completeGame={completeGame}
          />
        </Box>
        <Stack
          sx={{
            flex: 1,
            flexGrow: 1,
            justifyContent: "space-between",
            height: width > 1000 ? "80vh" : "100%",
          }}
        >
          <Tabs defaultValue="analysis">
            <Tabs.List grow>
              <Tabs.Tab value="analysis" icon={<IconZoomCheck size={16} />}>
                Analysis
              </Tabs.Tab>
              <Tabs.Tab value="database" icon={<IconDatabase size={16} />}>
                Database
              </Tabs.Tab>
              <Tabs.Tab value="annotate" icon={<IconNotes size={16} />}>
                Annotate
              </Tabs.Tab>
              <Tabs.Tab value="info" icon={<IconInfoCircle size={16} />}>
                Info
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="info" pt="xs">
              <Stack>
                <GameInfo game={game} />
                <FenInput form={form} onSubmit={resetToFen} />
                <PgnInput />
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="database" pt="xs">
              <DatabasePanel />
            </Tabs.Panel>
            <Tabs.Panel value="annotate" pt="xs">
              <AnnotationPanel forceUpdate={forceUpdate} setTree={setTree} />
            </Tabs.Panel>
            <Tabs.Panel value="analysis" pt="xs">
              <ScrollArea
                style={{ height: boardSize / 2 }}
                offsetScrollbars
                type="always"
              >
                <Stack>
                  <Accordion variant="separated" multiple chevronSize={0}>
                    {selectedEngines.map((engine, i) => {
                      return (
                        <Accordion.Item key={engine.name} value={engine.path}>
                          <BestMoves
                            id={i}
                            engine={engine}
                            makeMoves={makeMoves}
                            setArrows={setArrows}
                            setTree={setTree}
                          />
                        </Accordion.Item>
                      );
                    })}
                  </Accordion>
                  <EngineSettingsBoard
                    selectedEngines={selectedEngines}
                    setSelectedEngines={setSelectedEngines}
                  />
                  <Button
                    leftIcon={<IconZoomCheck size={14} />}
                    onClick={() => toggleReportingMode()}
                    loading={analysisLoading}
                  >
                    Generate Report
                  </Button>
                </Stack>
              </ScrollArea>
            </Tabs.Panel>
          </Tabs>
          <Stack>
            <GameNotation
              setTree={setTree}
              topVariation={tree.getTopVariation()}
              result={game.result}
              boardSize={width > 1000 ? boardSize : 600}
            />
            <MoveControls
              goToStart={goToStart}
              goToEnd={goToEnd}
              redoMove={redoMove}
              undoMove={undoMove}
            />
          </Stack>
        </Stack>
      </Flex>
    </TreeContext.Provider>
  );
}

export default BoardAnalysis;