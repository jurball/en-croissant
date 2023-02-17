import {
  ActionIcon,
  Box,
  CopyButton,
  createStyles,
  Divider,
  Group,
  Overlay,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  TypographyStylesProvider,
  useMantineTheme
} from "@mantine/core";
import { useForceUpdate, useToggle } from "@mantine/hooks";
import {
  IconArrowRight,
  IconArrowsSplit,
  IconArticle,
  IconArticleOff,
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconMinus,
  IconPlus
} from "@tabler/icons";
import { VariationTree } from "../../utils/chess";
import { Outcome } from "../../utils/db";
import CompleteMoveCell from "./CompleteMoveCell";
import OpeningName from "./OpeningName";

const useStyles = createStyles((theme) => ({
  scroller: {
    position: "sticky",
    top: 0,
    backgroundColor:
      theme.colorScheme === "dark" ? theme.colors.dark[7] : theme.white,
    zIndex: 10,
  },
}));

function GameNotation({
  setTree,
  topVariation,
  result,
  boardSize,
}: {
  setTree: (tree: VariationTree) => void;
  topVariation: VariationTree;
  result?: string;
  boardSize: number;
}) {
  const forceUpdate = useForceUpdate();
  const theme = useMantineTheme();
  const [invisible, toggleVisible] = useToggle();
  const [showVariations, toggleVariations] = useToggle([true, false]);
  const [showComments, toggleComments] = useToggle([true, false]);
  const { classes } = useStyles();
  const pgn = topVariation.getPGN();

  const multipleLine =
    topVariation.commentHTML.split("</p>").length - 1 > 1 ||
    topVariation.commentHTML.includes("<blockquote>") ||
    topVariation.commentHTML.includes("<ul>") ||
    topVariation.commentHTML.includes("<h");

  return (
    <Paper withBorder p="md" sx={{ position: "relative" }}>
      <ScrollArea sx={{ height: boardSize / 3 }} offsetScrollbars>
        <Stack>
          <Stack className={classes.scroller}>
            <Group style={{ justifyContent: "space-between" }}>
              <OpeningName />
              <Group spacing="sm">
                <Tooltip label={invisible ? "Show moves" : "Hide moves"}>
                  <ActionIcon onClick={() => toggleVisible()}>
                    {invisible ? (
                      <IconEyeOff size={15} />
                    ) : (
                      <IconEye size={15} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  label={showComments ? "Hide comments" : "Show comments"}
                >
                  <ActionIcon onClick={() => toggleComments()}>
                    {showComments ? (
                      <IconArticle size={15} />
                    ) : (
                      <IconArticleOff size={15} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <Tooltip
                  label={showVariations ? "Show Variations" : "Main line"}
                >
                  <ActionIcon onClick={() => toggleVariations()}>
                    {showVariations ? (
                      <IconArrowsSplit size={15} />
                    ) : (
                      <IconArrowRight size={15} />
                    )}
                  </ActionIcon>
                </Tooltip>
                <CopyButton value={pgn} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? "Copied" : "Copy PGN"} withArrow>
                      <ActionIcon
                        color={copied ? "teal" : "gray"}
                        onClick={copy}
                      >
                        {copied ? (
                          <IconCheck size={15} />
                        ) : (
                          <IconCopy size={15} />
                        )}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Group>
            <Divider />
          </Stack>
          <Box>
            {invisible && (
              <Overlay
                opacity={0.6}
                color={theme.colorScheme === "dark" ? "#222" : undefined}
                blur={3}
                zIndex={2}
              />
            )}
            {showComments && topVariation.commentHTML && (
              <TypographyStylesProvider
                style={{
                  display: multipleLine ? "block" : "inline-block",
                  marginLeft: 4,
                  marginRight: 4,
                }}
              >
                <span
                  dangerouslySetInnerHTML={{
                    __html: topVariation.commentHTML,
                  }}
                />
              </TypographyStylesProvider>
            )}
            <RenderVariationTree
              tree={topVariation}
              depth={0}
              first
              setTree={setTree}
              forceUpdate={forceUpdate}
              showVariations={showVariations}
              showComments={showComments}
            />
          </Box>
          {result !== Outcome.Unknown && (
            <Text align="center">
              {result}
              <br />
              <Text span fs="italic">
                {result === Outcome.Draw
                  ? "Draw"
                  : result === Outcome.WhiteWin
                  ? "White wins"
                  : "Black wins"}
              </Text>
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Paper>
  );
}

function RenderVariationTree({
  tree,
  depth,
  first,
  setTree,
  forceUpdate,
  showVariations,
  showComments,
}: {
  tree: VariationTree;
  depth: number;
  first?: boolean;
  setTree: (tree: VariationTree) => void;
  forceUpdate: () => void;
  showVariations: boolean;
  showComments: boolean;
}) {
  const variations = tree.children;
  const moveNodes = showVariations
    ? variations.slice(1).map((variation) => (
        <>
          <CompleteMoveCell
            tree={variation}
            setTree={setTree}
            forceUpdate={forceUpdate}
            showComments={showComments}
            first
          />
          <RenderVariationTree
            tree={variation}
            depth={depth + 2}
            setTree={setTree}
            first
            forceUpdate={forceUpdate}
            showVariations={showVariations}
            showComments={showComments}
          />
        </>
      ))
    : [];

  return (
    <>
      {variations.length > 0 && (
        <CompleteMoveCell
          tree={variations[0]}
          setTree={setTree}
          forceUpdate={forceUpdate}
          showComments={showComments}
          first={first}
        />
      )}

      <VariationCell moveNodes={moveNodes} />

      {tree.children.length > 0 && (
        <RenderVariationTree
          tree={tree.children[0]}
          depth={depth + 1}
          setTree={setTree}
          forceUpdate={forceUpdate}
          showVariations={showVariations}
          showComments={showComments}
        />
      )}
    </>
  );
}

function VariationCell({ moveNodes }: { moveNodes: React.ReactNode[] }) {
  const [invisible, toggleVisible] = useToggle();
  if (moveNodes.length > 1)
    return (
      <>
        <Box
          sx={{
            borderLeft: "2px solid #404040",
            paddingLeft: 5,
            marginLeft: 12,
          }}
        >
          <ActionIcon size="xs" onClick={() => toggleVisible()}>
            {invisible ? <IconPlus size={8} /> : <IconMinus size={8} />}
          </ActionIcon>
          {!invisible &&
            moveNodes.map((node, i) => (
              <Box
                key={i}
                sx={{
                  "::before": {
                    display: "inline-block",
                    content: '" "',
                    borderTop: "2px solid #404040",
                    width: 8,
                    height: 5,
                    marginLeft: -5,
                    marginTop: 16,
                  },
                }}
              >
                {node}
              </Box>
            ))}
        </Box>
      </>
    );
  else if (moveNodes.length === 1)
    return (
      <Box sx={{ fontStyle: "italic" }}>
        {"("}
        {moveNodes}
        {")"}
      </Box>
    );
  else return <></>;
}

export default GameNotation;