vim.cmd([[
filet indent on
filet plugin off
set rtp^=~/.vim
set bs=2
set mouse=
set nu
set scl=no
set nois
set hls
set et
set sts=3
set ai
set sw=3
set vb
set t_vb=
set sb
set spr
set hid
set nowrap
set bri
set list
set lcs=tab:>-,trail:~,precedes:<,extends:>
set ls=2
set stl=[%n:\%f]%m%r%w%y[%{&ff}][%{&enc}]%=[%l,%v][%P]
set cul
set cc=80
set winborder=single
set wim=longest,list,full

au BufReadPost *
 \ if line("'\"") >= 1 && line("'\"") <= line('$') && &ft !~# 'commit' |
 \    exe "normal! g`\"" |
 \ endif

au FileType cpp,fsharp,gluon set cc=100
au FileType cpp,fsharp,gluon,rust set mps+=<:>

au FileType go,mbld,myr
 \ setl noet |
 \ setl sts=8 |
 \ setl sw=8 |
 \ setl cc=100

au FileType rust
 \ set cc=101 |
 \ set comments^=:///,://!
]])

require("nord").setup({
   transparent = true,
   styles = {comments = {italic = false}},
   on_highlights = function(hls, c)
      hls["StatusLine"] = {fg = c.polar_night.light, bg = c.frost.polar_water}
      hls["StatusLineNC"] = {fg = c.polar_night.origin, bg = c.frost.polar_water}
      hls["DiagnosticUnderlineError"] = {link = "ErrorMsg"}
      hls["DiagnosticUnderlineWarn"] = {link = "WarningMsg"}
      hls["DiagnosticUnderlineInfo"] = {link = "WarningMsg"}
      hls["DiagnosticUnderlineHint"] = {link = "WarningMsg"}
   end,
})
vim.cmd.colorscheme("nord")

vim.keymap.set("i", "<C-space>", "<C-x><C-o>")
vim.keymap.set("n", "<C-p>", function()
   vim.call("fzf#run", {
      source = "git ls-files",
      sink = "e",
      up = "49%",
   })
end)

vim.diagnostic.config({
   virtual_text = true,
   jump = {float = true},
})
vim.keymap.set("n", "gre", vim.diagnostic.open_float)
vim.keymap.set("n", "<esc>", function()
  for _, win in ipairs(vim.api.nvim_list_wins()) do
    if vim.api.nvim_win_get_config(win).relative == "win" then
      vim.api.nvim_win_close(win, false)
    end
  end
end)

vim.lsp.config["rust-analyzer"] = {
   cmd = vim.lsp.rpc.connect("/run/ra-multiplex.sock"),
   filetypes = {"rust"},
   root_markers = {"Cargo.lock"},
   init_options = {
      lspMux = {
         version = "1",
         method = "connect",
         server = "rust-analyzer",
      },
   },
   settings = {
      ["rust-analyzer"] = {
         check = {command = "clippy"},
         completion = {callable = {snippets = "none"}},
         imports = {
            granularity = {group = "module"},
            merge = {glob = false},
         },
      },
   },
}
vim.lsp.enable("rust-analyzer")
