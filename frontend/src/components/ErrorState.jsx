export default function ErrorState({ message }) {
  return <p style={{ color: "red" }}>{message || "Something went wrong"}</p>;
}
