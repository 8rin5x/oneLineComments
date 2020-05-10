const vscode = require("vscode")
const XRegExp = require("xregexp")

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.oneLineComments.toggleLineComment",
      () => {
        new OneLineComments().toggleLineComent()
      }
    )
  )
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.oneLineComments.addLineComment",
      () => {
        new OneLineComments().addLineComment()
      }
    )
  )
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.oneLineComments.remLineComment",
      () => {
        new OneLineComments().remLineComment()
      }
    )
  )
}

class OneLineComments {
  base(defaultCommand, func) {
    let editor = vscode.window.activeTextEditor
    if (!editor) {
      return
    }

    const doc = editor.document

    if (new CommentTags(doc.languageId).getTags() === null) {
      vscode.commands.executeCommand(defaultCommand)
      return
    }

    const selection = editor.selection
    const comment_start_pos = new vscode.Position(
      selection.start.line,
      0
    )
    const comment_end_pos = new vscode.Position(
      selection.end.line,
      doc.lineAt(selection.end.line).text.length
    )

    const comment_selection = new vscode.Selection(comment_start_pos, comment_end_pos)
    let text = doc.getText(comment_selection)

    text = func(text, doc.languageId)

    let edit = new vscode.WorkspaceEdit()

    const range = new vscode.Range(comment_start_pos, comment_end_pos)

    edit.replace(doc.uri, range, text)
    return vscode.workspace.applyEdit(edit)
  }

  toggleLineComent() {
    this.base(
      "editor.action.commentLine",
      (text, lang) => {
        return new CommentReplace(text, lang).toggleLineComent()
      }
    )
  }

  addLineComment() {
    this.base(
      "editor.action.addCommentLine",
      (text, lang) => {
        return new CommentReplace(text, lang).addLineComment()
      }
    )
  }

  remLineComment() {
    this.base(
      "editor.action.removeCommentLine",
      (text, lang) => {
        return new CommentReplace(text, lang).remLineComment()
      }
    )
  }
}

class CommentTags {
  constructor(lang) {
    this.lang = lang
  }

  getTags() {
    let resultTags

    let customCommentTags = vscode.workspace.getConfiguration(
      "oneLineComments.customCommentTags"
    )[this.lang]

    if (!this.checkCommentTags(customCommentTags)) {
      return null
    }

    // customCommentTagsは読み取り専用なので新たに生成する必要があった
    resultTags = {
      "outer_start": customCommentTags.outer_start,
      "outer_end": customCommentTags.outer_end,
      "inner_start": customCommentTags.inner_start,
      "inner_end": customCommentTags.inner_end
    }

    // エスケープ済みタグを追加
    resultTags.escaped = {}
    for (const key in resultTags) {
      if (key === "escaped") {
        continue
      }
      resultTags.escaped[key] = "\\" + resultTags[key].split("").join("\\")
    }
    return resultTags
  }

  checkCommentTags(tags) {
    if (typeof tags !== "object") {
      return false
    }

    const requiredItems = [
      "outer_start",
      "outer_end",
      "inner_start",
      "inner_end"
    ]

    for (const item of requiredItems) {
      if (!tags.hasOwnProperty(item)) {
        return false
      }

      const value = tags[item]
      if (typeof value !== "string") {
        return false
      }

      {
        const minLength = 1
        const maxLength = 5
        if (value.length < minLength) {
          return false
        }
        if (value.length > maxLength) {
          return false
        }
      }

      if (!(/^[!"#$%&'()\*\+\-\.,\/:;<=>?@\[\\\]^_`{|}~]+$/g).test(value)) {
        // 記号以外が含まれる
        return false
      }
    }
    return true
  }
}

class CommentReplace {
  constructor(text, lang) {
    this.text = text
    this.lang = lang
  }

  toggleLineComent() {
    const tags = new CommentTags(this.lang).getTags()
    let lines = this.text.split(/\r\n|\r|\n/)
    let isAddComment = false
    for (let i = 0; i < lines.length; i++) {
      if ((/^[\s\t]*$/g).test(lines[i])) {
        // 空文字、スペース、タブのみ
        continue
      }

      if (!new RegExp(`${tags.escaped.outer_start}.*?${tags.escaped.outer_end}`, "g").test(lines[i])) {
        // コメント行じゃない
        isAddComment = true
        break
      }
    }

    if (isAddComment) {
      return this.addLineComment()
    } else {
      return this.remLineComment()
    }
  }

  addLineComment() {
    const tags = new CommentTags(this.lang).getTags()
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      if ((/^[\s\t]*$/g).test(lines[i])) {
        // 空文字、スペース、タブのみ
        continue
      }

      lines[i] = this.replaceCorrespondingCharacter(
        lines[i],
        tags.escaped.outer_start,
        tags.escaped.outer_end,
        tags.inner_start,
        tags.inner_end
      )

      lines[i] = lines[i].replace(
        /^([\s\t]*)(.*?)$/g,
        `$1${tags.outer_start} $2 ${tags.outer_end}`
      )
    }
    return lines.join("\n")
  }

  remLineComment() {
    const tags = new CommentTags(this.lang).getTags()
    let lines = this.text.split(/\r\n|\r|\n/)
    for (let i = 0; i < lines.length; i++) {
      lines[i] = this.replaceCorrespondingCharacter(
        lines[i],
        `${tags.escaped.outer_start}\\s?`,
        `\\s?${tags.escaped.outer_end}`,
        "",
        ""
      )

      lines[i] = this.replaceCorrespondingCharacter(
        lines[i],
        tags.escaped.inner_start,
        tags.escaped.inner_end,
        tags.outer_start,
        tags.outer_end
      )
    }
    return lines.join("\n")
  }

  replaceCorrespondingCharacter(str, beforeLeftRegexPattern, beforeRightRegexPattern, afterLeft, afterRight) {
    const matches = XRegExp.matchRecursive(
      str,
      beforeLeftRegexPattern,
      beforeRightRegexPattern,
      'g',
      {
        valueNames: [
          'between',
          'left',
          'match',
          'right'
        ]
      }
    )

    let result = ""
    for (const match of matches) {
      switch (match.name) {
        case "between":
          result += match.value
          break
        case "left":
          result += afterLeft
          break
        case "match":
          result += match.value
          break
        case "right":
          result += afterRight
      }
    }
    return result
  }
}

function deactivate() { }

module.exports = {
  activate,
  deactivate
}