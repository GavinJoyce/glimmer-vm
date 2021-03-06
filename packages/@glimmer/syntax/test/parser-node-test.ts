import { preprocess as parse, builders as b } from '..';

import { astEqual } from './support';

const test = QUnit.test;

QUnit.module('[glimmer-syntax] Parser - AST');

test('a simple piece of content', function() {
  let t = 'some content';
  astEqual(t, b.program([b.text('some content')]));
});

test('self-closed element', function() {
  let t = '<g />';
  astEqual(t, b.program([b.element('g/')]));
});

test('elements can have empty attributes', function() {
  let t = '<img id="">';
  astEqual(t, b.program([b.element('img', { attrs: [b.attr('id', b.text(''))] })]));
});

test('disallowed quote in element space is rejected', function(assert) {
  let t = '<img foo="bar"" >';
  assert.throws(() => {
    parse(t);
  }, /Syntax error at line 1 col 14: " is not a valid character within attribute names/);
});

test('disallowed equals sign in element space is rejected', function(assert) {
  let t = '<img =foo >';
  assert.throws(() => {
    parse(t);
  }, /Syntax error at line 1 col 5: attribute name cannot start with equals sign/);
});

test('svg content', function() {
  let t = '<svg></svg>';
  astEqual(t, b.program([b.element('svg')]));
});

test('html content with html content inline', function() {
  let t = '<div><p></p></div>';
  astEqual(t, b.program([b.element('div', ['body', b.element('p')])]));
});

test('html content with svg content inline', function() {
  let t = '<div><svg></svg></div>';
  astEqual(t, b.program([b.element('div', ['body', b.element('svg')])]));
});

let integrationPoints = ['foreignObject', 'desc', 'title'];
function buildIntegrationPointTest(integrationPoint: string) {
  return function integrationPointTest() {
    let t = '<svg><' + integrationPoint + '><div></div></' + integrationPoint + '></svg>';
    astEqual(
      t,
      b.program([
        b.element('svg', ['body', b.element(integrationPoint, ['body', b.element('div')])]),
      ])
    );
  };
}
for (let i = 0, length = integrationPoints.length; i < length; i++) {
  test(
    'svg content with html content inline for ' + integrationPoints[i],
    buildIntegrationPointTest(integrationPoints[i])
  );
}

test('a piece of content with HTML', function() {
  let t = 'some <div>content</div> done';
  astEqual(
    t,
    b.program([b.text('some '), b.element('div', ['body', b.text('content')]), b.text(' done')])
  );
});

test('a piece of Handlebars with HTML', function() {
  let t = 'some <div>{{content}}</div> done';
  astEqual(
    t,
    b.program([
      b.text('some '),
      b.element('div', ['body', b.mustache(b.path('content'))]),
      b.text(' done'),
    ])
  );
});

test('Handlebars embedded in an attribute (quoted)', function() {
  let t = 'some <div class="{{foo}}">content</div> done';
  astEqual(
    t,
    b.program([
      b.text('some '),
      b.element(
        'div',
        ['attrs', ['class', b.concat([b.mustache('foo')])]],
        ['body', b.text('content')]
      ),
      b.text(' done'),
    ])
  );
});

test('Handlebars embedded in an attribute (unquoted)', function() {
  let t = 'some <div class={{foo}}>content</div> done';
  astEqual(
    t,
    b.program([
      b.text('some '),
      b.element(
        'div',
        ['attrs', ['class', b.mustache(b.path('foo'))]],
        ['body', b.text('content')]
      ),
      b.text(' done'),
    ])
  );
});

test('Handlebars embedded in an attribute of a self-closing tag (unqouted)', function() {
  let t = '<input value={{foo}}/>';

  let element = b.element('input/', ['attrs', ['value', b.mustache(b.path('foo'))]]);
  astEqual(t, b.program([element]));
});

test('Handlebars embedded in an attribute (sexprs)', function() {
  let t = 'some <div class="{{foo (foo "abc")}}">content</div> done';
  astEqual(
    t,
    b.program([
      b.text('some '),
      b.element(
        'div',
        [
          'attrs',
          [
            'class',
            b.concat([b.mustache(b.path('foo'), [b.sexpr(b.path('foo'), [b.string('abc')])])]),
          ],
        ],
        ['body', b.text('content')]
      ),
      b.text(' done'),
    ])
  );
});

test('Handlebars embedded in an attribute with other content surrounding it', function() {
  let t = 'some <a href="http://{{link}}/">content</a> done';
  astEqual(
    t,
    b.program([
      b.text('some '),
      b.element(
        'a',
        ['attrs', ['href', b.concat([b.text('http://'), b.mustache('link'), b.text('/')])]],
        ['body', b.text('content')]
      ),
      b.text(' done'),
    ])
  );
});

test('A more complete embedding example', function() {
  let t =
    "{{embed}} {{some 'content'}} " +
    "<div class='{{foo}} {{bind-class isEnabled truthy='enabled'}}'>{{ content }}</div>" +
    " {{more 'embed'}}";
  astEqual(
    t,
    b.program([
      b.mustache(b.path('embed')),
      b.text(' '),
      b.mustache(b.path('some'), [b.string('content')]),
      b.text(' '),
      b.element(
        'div',
        [
          'attrs',
          [
            'class',
            b.concat([
              b.mustache('foo'),
              b.text(' '),
              b.mustache(
                'bind-class',
                [b.path('isEnabled')],
                b.hash([b.pair('truthy', b.string('enabled'))])
              ),
            ]),
          ],
        ],
        ['body', b.mustache(b.path('content'))]
      ),
      b.text(' '),
      b.mustache(b.path('more'), [b.string('embed')]),
    ])
  );
});

test('Simple embedded block helpers', function() {
  let t = '{{#if foo}}<div>{{content}}</div>{{/if}}';
  astEqual(
    t,
    b.program([
      b.block(
        b.path('if'),
        [b.path('foo')],
        b.hash(),
        b.program([b.element('div', ['body', b.mustache(b.path('content'))])])
      ),
    ])
  );
});

test('Involved block helper', function() {
  let t =
    '<p>hi</p> content {{#testing shouldRender}}<p>Appears!</p>{{/testing}} more <em>content</em> here';
  astEqual(
    t,
    b.program([
      b.element('p', ['body', b.text('hi')]),
      b.text(' content '),
      b.block(
        b.path('testing'),
        [b.path('shouldRender')],
        b.hash(),
        b.program([b.element('p', ['body', b.text('Appears!')])])
      ),
      b.text(' more '),
      b.element('em', ['body', b.text('content')]),
      b.text(' here'),
    ])
  );
});

test('Element modifiers', function() {
  let t = "<p {{action 'boom'}} class='bar'>Some content</p>";
  astEqual(
    t,
    b.program([
      b.element(
        'p',
        ['attrs', ['class', 'bar']],
        ['modifiers', ['action', [b.string('boom')]]],
        ['body', b.text('Some content')]
      ),
    ])
  );
});

test('Tokenizer: MustacheStatement encountered in beforeAttributeName state', function() {
  let t = '<input {{bar}}>';
  astEqual(t, b.program([b.element('input', ['modifiers', 'bar'])]));
});

test('Tokenizer: MustacheStatement encountered in attributeName state', function() {
  let t = '<input foo{{bar}}>';
  astEqual(t, b.program([b.element('input', ['attrs', ['foo', '']], ['modifiers', ['bar']])]));
});

test('Tokenizer: MustacheStatement encountered in afterAttributeName state', function() {
  let t = '<input foo {{bar}}>';
  astEqual(t, b.program([b.element('input', ['attrs', ['foo', '']], ['modifiers', 'bar'])]));
});

test('Tokenizer: MustacheStatement encountered in afterAttributeValue state', function() {
  let t = '<input foo=1 {{bar}}>';
  astEqual(t, b.program([b.element('input', ['attrs', ['foo', '1']], ['modifiers', ['bar']])]));
});

test('Tokenizer: MustacheStatement encountered in afterAttributeValueQuoted state', function() {
  let t = "<input foo='1'{{bar}}>";
  astEqual(t, b.program([b.element('input', ['attrs', ['foo', '1']], ['modifiers', 'bar'])]));
});

test('Stripping - mustaches', function() {
  let t = 'foo {{~content}} bar';
  astEqual(t, b.program([b.text('foo'), b.mustache(b.path('content')), b.text(' bar')]));

  t = 'foo {{content~}} bar';
  astEqual(t, b.program([b.text('foo '), b.mustache(b.path('content')), b.text('bar')]));
});

test('Stripping - blocks', function() {
  let t = 'foo {{~#wat}}{{/wat}} bar';
  astEqual(
    t,
    b.program([b.text('foo'), b.block(b.path('wat'), [], b.hash(), b.program()), b.text(' bar')])
  );

  t = 'foo {{#wat}}{{/wat~}} bar';
  astEqual(
    t,
    b.program([b.text('foo '), b.block(b.path('wat'), [], b.hash(), b.program()), b.text('bar')])
  );
});

test('Stripping - programs', function() {
  let t = '{{#wat~}} foo {{else}}{{/wat}}';
  astEqual(
    t,
    b.program([b.block(b.path('wat'), [], b.hash(), b.program([b.text('foo ')]), b.program())])
  );

  t = '{{#wat}} foo {{~else}}{{/wat}}';
  astEqual(
    t,
    b.program([b.block(b.path('wat'), [], b.hash(), b.program([b.text(' foo')]), b.program())])
  );

  t = '{{#wat}}{{else~}} foo {{/wat}}';
  astEqual(
    t,
    b.program([b.block(b.path('wat'), [], b.hash(), b.program(), b.program([b.text('foo ')]))])
  );

  t = '{{#wat}}{{else}} foo {{~/wat}}';
  astEqual(
    t,
    b.program([b.block(b.path('wat'), [], b.hash(), b.program(), b.program([b.text(' foo')]))])
  );
});

test('Stripping - removes unnecessary text nodes', function() {
  let t = '{{#each~}}\n  <li> foo </li>\n{{~/each}}';

  astEqual(
    t,
    b.program([
      b.block(
        b.path('each'),
        [],
        b.hash(),
        b.program([b.element('li', ['body', b.text(' foo ')])]),
        null
      ),
    ])
  );
});

test('Whitespace control - linebreaks after blocks removed by default', function() {
  let t = '{{#each}}\n  <li> foo </li>\n{{/each}}';

  astEqual(
    t,
    b.program([
      b.block(
        b.path('each'),
        [],
        b.hash(),
        b.program([b.text('  '), b.element('li', ['body', b.text(' foo ')]), b.text('\n')]),
        null
      ),
    ])
  );
});

test('Whitespace control - preserve all whitespace if config is set', function() {
  let t = '{{#each}}\n  <li> foo </li>\n{{/each}}';

  astEqual(
    t,
    b.program([
      b.block(
        b.path('each'),
        [],
        b.hash(),
        b.program([b.text('\n  '), b.element('li', ['body', b.text(' foo ')]), b.text('\n')]),
        null
      ),
    ]),
    undefined,
    {
      parseOptions: { ignoreStandalone: true },
    }
  );
});

// TODO: Make these throw an error.
//test("Awkward mustache in unquoted attribute value", function() {
//  let t = "<div class=a{{foo}}></div>";
//  astEqual(t, b.program([
//    b.element('div', [ b.attr('class', concat([b.string("a"), b.sexpr([b.path('foo')])])) ])
//  ]));
//
//  t = "<div class=a{{foo}}b></div>";
//  astEqual(t, b.program([
//    b.element('div', [ b.attr('class', concat([b.string("a"), b.sexpr([b.path('foo')]), b.string("b")])) ])
//  ]));
//
//  t = "<div class={{foo}}b></div>";
//  astEqual(t, b.program([
//    b.element('div', [ b.attr('class', concat([b.sexpr([b.path('foo')]), b.string("b")])) ])
//  ]));
//});

test('an HTML comment', function() {
  let t = 'before <!-- some comment --> after';
  astEqual(t, b.program([b.text('before '), b.comment(' some comment '), b.text(' after')]));
});

test('a Handlebars comment inside an HTML comment', function() {
  let t = 'before <!-- some {{! nested thing }} comment --> after';
  astEqual(
    t,
    b.program([
      b.text('before '),
      b.comment(' some {{! nested thing }} comment '),
      b.text(' after'),
    ])
  );
});

test('a Handlebars comment', function() {
  let t = 'before {{! some comment }} after';
  astEqual(
    t,
    b.program([b.text('before '), b.mustacheComment(' some comment '), b.text(' after')])
  );
});

test('a Handlebars comment in proper element space', function() {
  let t = 'before <div {{! some comment }} data-foo="bar" {{! other comment }}></div> after';
  astEqual(
    t,
    b.program([
      b.text('before '),
      b.element(
        'div',
        ['attrs', ['data-foo', b.text('bar')]],
        ['comments', b.mustacheComment(' some comment '), b.mustacheComment(' other comment ')]
      ),
      b.text(' after'),
    ])
  );
});

test('a Handlebars comment in invalid element space', function(assert) {
  assert.throws(() => {
    parse('\nbefore <div \n  a{{! some comment }} data-foo="bar"></div> after');
  }, /Using a Handlebars comment when in the `attributeName` state is not supported: " some comment " on line 3:3/);

  assert.throws(() => {
    parse('\nbefore <div \n  a={{! some comment }} data-foo="bar"></div> after');
  }, /Using a Handlebars comment when in the `beforeAttributeValue` state is not supported: " some comment " on line 3:4/);

  assert.throws(() => {
    parse('\nbefore <div \n  a="{{! some comment }}" data-foo="bar"></div> after');
  }, /Using a Handlebars comment when in the `attributeValueDoubleQuoted` state is not supported: " some comment " on line 3:5/);
});

test('allow {{null}} to be passed as helper name', function() {
  let ast = parse('{{null}}');

  astEqual(ast, b.program([b.mustache(b.null())]));
});

test('allow {{null}} to be passed as a param', function() {
  let ast = parse('{{foo null}}');

  astEqual(ast, b.program([b.mustache(b.path('foo'), [b.null()])]));
});

test('allow {{undefined}} to be passed as helper name', function() {
  let ast = parse('{{undefined}}');

  astEqual(ast, b.program([b.mustache(b.undefined())]));
});

test('allow {{undefined}} to be passed as a param', function() {
  let ast = parse('{{foo undefined}}');

  astEqual(ast, b.program([b.mustache(b.path('foo'), [b.undefined()])]));
});

test('Handlebars partial should error', function(assert) {
  assert.throws(() => {
    parse('{{> foo}}');
  }, Error(`Handlebars partials are not supported: "{{> foo" at L1:C0`));
});

test('Handlebars partial block should error', function(assert) {
  assert.throws(() => {
    parse('{{#> foo}}{{/foo}}');
  }, new Error(`Handlebars partial blocks are not supported: "{{#> foo" at L1:C0`));
});

test('Handlebars decorator should error', function(assert) {
  assert.throws(() => {
    parse('{{* foo}}');
  }, new Error(`Handlebars decorators are not supported: "{{* foo" at L1:C0`));
});

test('Handlebars decorator block should error', function(assert) {
  assert.throws(() => {
    parse('{{#* foo}}{{/foo}}');
  }, new Error(`Handlebars decorator blocks are not supported: "{{#* foo" at L1:C0`));
});

test('disallowed mustaches in the tagName space', function(assert) {
  assert.throws(() => {
    parse('<{{"asdf"}}></{{"asdf"}}>');
  }, /Cannot use mustaches in an elements tagname: `{{"asdf"` at L1:C1/);

  assert.throws(() => {
    parse('<input{{bar}}>');
  }, /Cannot use mustaches in an elements tagname: `{{bar` at L1:C6/);
});

test('mustache immediately followed by self closing tag does not error', function() {
  let ast = parse('<FooBar data-foo={{blah}}/>');
  let element = b.element('FooBar/', ['attrs', ['data-foo', b.mustache('blah')]]);
  astEqual(ast, b.program([element]));
});

QUnit.dump.maxDepth = 100;

test('named blocks', () => {
  let ast = parse(strip`
    <Tab>
      <:header>
        It's a header!
      </:header>

      <:body as |contents|>
        <div>{{contents}}</div>
      </:body>
    </Tab>
  `);

  let element = b.element('Tab', [
    'body',
    b.element(':header', ['body', b.text(`It's a header!`)]),
    b.element(
      ':body',
      ['body', b.element('div', ['body', b.mustache('contents')])],
      ['as', 'contents']
    ),
  ]);
  astEqual(ast, b.program([element]));
});

test('path expression with "dangling dot" throws error', function(assert) {
  assert.throws(() => {
    parse('{{if foo. bar baz}}');
  }, /'\.' is not a supported path in Glimmer; check for a path with a trailing '\.' at L1:C8/);
});

export function strip(strings: TemplateStringsArray, ...args: string[]) {
  return strings
    .map((str: string, i: number) => {
      return `${str
        .split('\n')
        .map(s => s.trim())
        .join('')}${args[i] ? args[i] : ''}`;
    })
    .join('');
}
