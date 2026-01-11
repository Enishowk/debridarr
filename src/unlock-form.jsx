import { useState } from "preact/hooks";
import { useStatus } from "./status-box/status-context";
import { extractLinks } from "./utils";

export function UnlockForm({ setUnlockLinks }) {
  const { setStatus } = useStatus();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const formJson = Object.fromEntries(formData.entries());
    const links = extractLinks(formJson.links);

    if (links.length === 0) {
      setStatus(
        "error",
        "No valid links found. Links should start with http:// ou https://",
      );
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ links }),
      });
      const data = await response.json();
      setUnlockLinks(data.results);
    } catch (error) {
      setStatus("error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>
        Links to unlock
        <span className="unlock-subtitle"> (One link per line)</span>
      </h2>
      <form onSubmit={handleSubmit}>
        <textarea
          className="unlock-textarea"
          name="links"
          placeholder="https://example.com/file1&#10;https://example.com/file2"
          rows={5}
          required
        ></textarea>
        <div className="button-group">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : "Unlock"}
          </button>
          <button type="reset" className="btn" disabled={loading}>
            Reset
          </button>
        </div>
      </form>
    </section>
  );
}
