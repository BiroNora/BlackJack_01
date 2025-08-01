interface InsProps {
  insMessage: boolean;
}

const InsMessage: React.FC<InsProps> = ({ insMessage }) => {
  return (
    <div>{insMessage && <div className="ins merriweather9">Insurance lost</div>}</div>
  );
};

export default InsMessage;
