interface InsProps {
  insMessage: boolean;
}

const InsMessage: React.FC<InsProps> = ({ insMessage }) => {
  return (
    <div>{insMessage && <div className="ins">Insurance lost</div>}</div>
  );
};

export default InsMessage;
