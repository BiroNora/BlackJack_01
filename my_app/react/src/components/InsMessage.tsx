import "../styles/winner.css";

interface InsProps {
  insMessage: boolean;
}

const InsMessage: React.FC<InsProps> = ({ insMessage }) => {
  return (
    <div>{insMessage && <div className="winners">Insurance lost</div>}</div>
  );
};

export default InsMessage;
