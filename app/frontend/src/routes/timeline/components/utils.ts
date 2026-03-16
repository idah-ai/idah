export function getFrameFromMouseX(props: {
  clientX: number;
  timelineRowHeaderWidth: number;
  timelineCellWidth: number;
}) {
  const { clientX, timelineRowHeaderWidth, timelineCellWidth } = props;
  return Math.ceil((clientX - timelineRowHeaderWidth) / timelineCellWidth);
}
