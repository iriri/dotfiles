colo default
syntax enable
filetype plugin indent on
set bs=2
set nu
set nois
set hls
set et
set sts=4
set ai
set sw=4
set vb
set t_vb=
set hid
set list
set lcs=eol:$,tab:>-,trail:~,precedes:<,extends:>
set ls=2
set stl=[%n:\%f]%m%r%w%y[%{&ff}][%{&enc}]%=[%l,%v][%P]
set cul
hi CursorLine cterm=NONE ctermbg=0 ctermfg=NONE
2mat ErrorMsg '\%80v.'

autocmd BufReadPost *
  \ if line("'\"") >= 1 && line("'\"") <= line("$") && &ft !~# 'commit'
  \ |   exe "normal! g`\""
  \ | endif

au FileType myr setlocal noet |
            \setlocal sts=8 |
            \setlocal sw=8 |
            \2mat ErrorMsg '\%100v.'

au FileType go setlocal sts=8 | setlocal sw=8 | 2mat ErrorMsg '\%100v.'

au FileType ocaml setlocal commentstring=(*%s*)
let g:opamshare = substitute(system('opam config var share'),'\n$','','''')
exe "setlocal rtp+=" . g:opamshare . "/merlin/vim"
exe "setlocal rtp+=" . g:opamshare . "/ocp-indent/vim"

au FileType rust 2mat ErrorMsg '\%100v.'
