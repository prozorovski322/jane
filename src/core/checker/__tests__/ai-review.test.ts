import { AiReviewError, buildPrompt, parseReview, requestAiReview } from '../ai-review';

const REVIEW = {
  summary: 'Хороший текст.',
  corrected: 'I like tea.',
  issues: [{ original: 'I likes tea', fix: 'I like tea', why: 'после I глагол без -s' }],
};

const reply = (text: string, status = 200) =>
  jest.fn(
    async () => new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status }),
  ) as unknown as typeof fetch;

describe('AI review', () => {
  it('wraps the task and the text as data', () => {
    expect(buildPrompt('Напишите о себе', 'I am Anna.')).toBe(
      '<task>Напишите о себе</task>\n<text>I am Anna.</text>',
    );
  });

  it('parses JSON, also inside a code fence', () => {
    const json = JSON.stringify(REVIEW);
    expect(parseReview(json)).toEqual(REVIEW);
    expect(parseReview('```json\n' + json + '\n```')).toEqual(REVIEW);
  });

  it('rejects replies that do not match the shape', () => {
    expect(() => parseReview('no json here')).toThrow(AiReviewError);
    expect(() => parseReview('{"summary": 1}')).toThrow(AiReviewError);
  });

  it('sends the key as a header and the text as a user message', async () => {
    const fetchImpl = reply(JSON.stringify(REVIEW));
    const review = await requestAiReview(
      { task: 't', text: 'I likes tea', apiKey: 'sk-test' },
      fetchImpl,
    );
    expect(review.issues).toHaveLength(1);
    const [url, init] = (fetchImpl as unknown as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-test');
    const body = JSON.parse(init.body as string);
    expect(body.messages[0].content).toContain('<text>I likes tea</text>');
  });

  it.each([
    [401, 'bad-key'],
    [429, 'rate-limit'],
    [500, 'bad-response'],
  ])('maps HTTP %i to %s', async (status, code) => {
    await expect(
      requestAiReview({ task: 't', text: 'x', apiKey: 'k' }, reply('{}', status)),
    ).rejects.toMatchObject({ code });
  });

  it('maps a network failure to the network error', async () => {
    const failing = jest.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await expect(
      requestAiReview({ task: 't', text: 'x', apiKey: 'k' }, failing),
    ).rejects.toMatchObject({
      code: 'network',
    });
  });
});
